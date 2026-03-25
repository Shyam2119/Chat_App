from __future__ import annotations
from datetime import datetime, timezone
from flask import request
from flask_socketio import emit, join_room, leave_room, disconnect
from flask_jwt_extended import decode_token
from jwt.exceptions import InvalidTokenError

from . import socketio
from .extensions import db
from .models import User, Room, Message, ReadReceipt, MessageReaction, PinnedMessage

# sid → user_id mapping (in-memory; fine for single-process Render deploy)
connected_users: dict[str, int] = {}


# --------------------------------------------------------------------------- #
#  Helpers                                                                     #
# --------------------------------------------------------------------------- #
def _auth_user(token: str) -> User | None:
    try:
        decoded = decode_token(token)
        user_id = int(decoded["sub"])   # sub is stored as string, cast to int
        return User.query.get(user_id)
    except (InvalidTokenError, Exception):
        return None


def _set_online(user: User, online: bool):
    user.is_online = online
    user.last_seen = datetime.now(timezone.utc)
    db.session.commit()


# --------------------------------------------------------------------------- #
#  Connection                                                                  #
# --------------------------------------------------------------------------- #
@socketio.on("connect")
def on_connect(auth):
    token = (auth or {}).get("token")
    user = _auth_user(token) if token else None
    if not user:
        disconnect()
        return False

    connected_users[request.sid] = user.id
    _set_online(user, True)

    # Auto-join all rooms the user belongs to
    for room in user.rooms:
        join_room(f"room_{room.id}")

    # Notify others
    emit("user_online", {
        "userId": user.id,
        "username": user.username,
        "statusText": user.status_text,
        "statusEmoji": user.status_emoji,
    }, broadcast=True, include_self=False)
    emit("connected", {"userId": user.id})


@socketio.on("disconnect")
def on_disconnect():
    user_id = connected_users.pop(request.sid, None)
    if user_id:
        user = User.query.get(user_id)
        if user:
            _set_online(user, False)
            emit("user_offline", {
                "userId": user.id,
                "lastSeen": user.last_seen.isoformat()
            }, broadcast=True, include_self=False)


# --------------------------------------------------------------------------- #
#  Rooms                                                                       #
# --------------------------------------------------------------------------- #
@socketio.on("join_room")
def on_join_room(data):
    room_id = data.get("roomId")
    user_id = connected_users.get(request.sid)
    if not room_id or not user_id:
        return

    room = Room.query.get(room_id)
    user = User.query.get(user_id)
    if not room or not user or user not in room.members:
        return

    join_room(f"room_{room_id}")
    emit("room_joined", {"roomId": room_id}, room=f"room_{room_id}")


@socketio.on("leave_room")
def on_leave_room(data):
    room_id = data.get("roomId")
    if room_id:
        leave_room(f"room_{room_id}")


# --------------------------------------------------------------------------- #
#  Messages                                                                    #
# --------------------------------------------------------------------------- #
@socketio.on("send_message")
def on_send_message(data):
    user_id = connected_users.get(request.sid)
    if not user_id:
        return

    room_id = data.get("roomId")
    content = (data.get("content") or "").strip()
    reply_to_id = data.get("replyToId")
    message_type = data.get("messageType", "text")
    file_url = data.get("fileUrl")
    file_name = data.get("fileName")
    file_size = data.get("fileSize")

    if not room_id or (not content and not file_url):
        emit("error", {"message": "roomId and content/file are required"})
        return

    room = Room.query.get(room_id)
    user = User.query.get(user_id)
    if not room or not user or user not in room.members:
        emit("error", {"message": "Not a member of this room"})
        return

    msg = Message(
        content=content or file_name or "File",
        message_type=message_type,
        room_id=room_id,
        sender_id=user_id,
        reply_to_id=reply_to_id,
        file_url=file_url,
        file_name=file_name,
        file_size=file_size,
    )
    db.session.add(msg)
    db.session.flush()

    # Auto-mark as read for the sender
    receipt = ReadReceipt(message_id=msg.id, user_id=user_id)
    db.session.add(receipt)
    db.session.commit()

    emit("new_message", msg.to_dict(), room=f"room_{room_id}")


@socketio.on("edit_message")
def on_edit_message(data):
    user_id = connected_users.get(request.sid)
    msg = Message.query.get(data.get("messageId"))
    if not msg or msg.sender_id != user_id:
        return
    content = (data.get("content") or "").strip()
    if not content:
        return
    msg.content = content
    msg.is_edited = True
    db.session.commit()
    emit("message_updated", msg.to_dict(), room=f"room_{msg.room_id}")


@socketio.on("delete_message")
def on_delete_message(data):
    user_id = connected_users.get(request.sid)
    msg = Message.query.get(data.get("messageId"))
    if not msg or msg.sender_id != user_id:
        return
    msg.is_deleted = True
    db.session.commit()
    emit("message_updated", msg.to_dict(), room=f"room_{msg.room_id}")


# --------------------------------------------------------------------------- #
#  Forward Message via Socket                                                  #
# --------------------------------------------------------------------------- #
@socketio.on("forward_message")
def on_forward_message(data):
    user_id = connected_users.get(request.sid)
    if not user_id:
        return
    original_id = data.get("messageId")
    target_room_id = data.get("roomId")
    original = Message.query.get(original_id)
    room = Room.query.get(target_room_id)
    user = User.query.get(user_id)
    if not original or not room or not user or user not in room.members:
        return

    fwd = Message(
        content=original.content,
        message_type="forwarded",
        room_id=target_room_id,
        sender_id=user_id,
        forwarded_from_id=original.id,
        file_url=original.file_url,
        file_name=original.file_name,
        file_size=original.file_size,
    )
    db.session.add(fwd)
    db.session.flush()

    receipt = ReadReceipt(message_id=fwd.id, user_id=user_id)
    db.session.add(receipt)
    db.session.commit()

    emit("new_message", fwd.to_dict(), room=f"room_{target_room_id}")


# --------------------------------------------------------------------------- #
#  Read Receipts                                                               #
# --------------------------------------------------------------------------- #
@socketio.on("mark_read")
def on_mark_read(data):
    user_id = connected_users.get(request.sid)
    message_id = data.get("messageId")
    if not user_id or not message_id:
        return

    existing = ReadReceipt.query.filter_by(
        message_id=message_id, user_id=user_id
    ).first()
    if not existing:
        receipt = ReadReceipt(message_id=message_id, user_id=user_id)
        db.session.add(receipt)
        db.session.commit()

    msg = Message.query.get(message_id)
    if msg:
        emit("read_receipt", {
            "messageId": message_id,
            "userId": user_id,
            "roomId": msg.room_id,
        }, room=f"room_{msg.room_id}")


# --------------------------------------------------------------------------- #
#  Typing Indicators                                                           #
# --------------------------------------------------------------------------- #
@socketio.on("typing_start")
def on_typing_start(data):
    user_id = connected_users.get(request.sid)
    room_id = data.get("roomId")
    if user_id and room_id:
        user = User.query.get(user_id)
        emit("user_typing", {"userId": user_id, "username": user.username if user else "", "roomId": room_id},
             room=f"room_{room_id}", include_self=False)


@socketio.on("typing_stop")
def on_typing_stop(data):
    user_id = connected_users.get(request.sid)
    room_id = data.get("roomId")
    if user_id and room_id:
        emit("user_stopped_typing", {"userId": user_id, "roomId": room_id},
             room=f"room_{room_id}", include_self=False)


# --------------------------------------------------------------------------- #
#  Reactions                                                                   #
# --------------------------------------------------------------------------- #
@socketio.on("add_reaction")
def on_add_reaction(data):
    user_id = connected_users.get(request.sid)
    message_id = data.get("messageId")
    emoji = (data.get("emoji") or "").strip()
    if not user_id or not message_id or not emoji:
        return

    msg = Message.query.get(message_id)
    if not msg:
        return

    existing = MessageReaction.query.filter_by(
        message_id=message_id, user_id=user_id, emoji=emoji
    ).first()
    if not existing:
        reaction = MessageReaction(
            message_id=message_id, user_id=user_id, emoji=emoji
        )
        db.session.add(reaction)
        db.session.commit()

    # Broadcast updated reactions
    emit("reaction_updated", {
        "messageId": msg.id,
        "roomId": msg.room_id,
        "reactions": msg.to_dict().get("reactions", {})
    }, room=f"room_{msg.room_id}")


@socketio.on("remove_reaction")
def on_remove_reaction(data):
    user_id = connected_users.get(request.sid)
    message_id = data.get("messageId")
    emoji = (data.get("emoji") or "").strip()
    if not user_id or not message_id or not emoji:
        return

    msg = Message.query.get(message_id)
    if not msg:
        return

    existing = MessageReaction.query.filter_by(
        message_id=message_id, user_id=user_id, emoji=emoji
    ).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()

    emit("reaction_updated", {
        "messageId": msg.id,
        "roomId": msg.room_id,
        "reactions": msg.to_dict().get("reactions", {})
    }, room=f"room_{msg.room_id}")


# --------------------------------------------------------------------------- #
#  Pin / Unpin via Socket                                                      #
# --------------------------------------------------------------------------- #
@socketio.on("pin_message")
def on_pin_message(data):
    from .models import PinnedMessage
    user_id = connected_users.get(request.sid)
    message_id = data.get("messageId")
    if not user_id or not message_id:
        return
    msg = Message.query.get(message_id)
    if not msg:
        return
    existing = PinnedMessage.query.filter_by(
        message_id=message_id, room_id=msg.room_id
    ).first()
    if not existing:
        pin = PinnedMessage(
            message_id=message_id, room_id=msg.room_id, pinned_by=user_id
        )
        db.session.add(pin)
        db.session.commit()
    emit("message_pinned", {
        "messageId": message_id,
        "roomId": msg.room_id,
        "pinnedBy": user_id,
    }, room=f"room_{msg.room_id}")


@socketio.on("unpin_message")
def on_unpin_message(data):
    from .models import PinnedMessage
    user_id = connected_users.get(request.sid)
    message_id = data.get("messageId")
    if not user_id or not message_id:
        return
    msg = Message.query.get(message_id)
    if not msg:
        return
    pin = PinnedMessage.query.filter_by(
        message_id=message_id, room_id=msg.room_id
    ).first()
    if pin:
        db.session.delete(pin)
        db.session.commit()
    emit("message_unpinned", {
        "messageId": message_id,
        "roomId": msg.room_id,
    }, room=f"room_{msg.room_id}")


# --------------------------------------------------------------------------- #
#  Status Update                                                               #
# --------------------------------------------------------------------------- #
@socketio.on("update_status")
def on_update_status(data):
    user_id = connected_users.get(request.sid)
    if not user_id:
        return
    user = User.query.get(user_id)
    if not user:
        return
    status_text = (data.get("statusText") or "")[:100]
    status_emoji = (data.get("statusEmoji") or "")[:10]
    user.status_text = status_text
    user.status_emoji = status_emoji
    db.session.commit()
    emit("user_status_updated", {
        "userId": user.id,
        "statusText": status_text,
        "statusEmoji": status_emoji,
    }, broadcast=True)
