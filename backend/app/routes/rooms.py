from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func
from ..extensions import db
from ..models import (
    Room, User, Message, ReadReceipt, PinnedMessage, MutedRoom, room_members,
)

rooms_bp = Blueprint("rooms", __name__)


@rooms_bp.route("/", methods=["GET"])
@jwt_required()
def my_rooms():
    me = User.query.get(int(get_jwt_identity()))
    rooms = me.rooms
    result = []
    # Build set of muted room ids for current user
    muted_ids = set(
        m.room_id for m in MutedRoom.query.filter_by(user_id=me.id).all()
    )
    for r in rooms:
        d = r.to_dict(current_user_id=me.id)
        # Unread count
        total_msgs = Message.query.filter_by(room_id=r.id, is_deleted=False).count()
        read_msgs = (
            db.session.query(func.count(ReadReceipt.id))
            .join(Message, ReadReceipt.message_id == Message.id)
            .filter(Message.room_id == r.id, ReadReceipt.user_id == me.id)
            .scalar()
        )
        d["unreadCount"] = max(0, total_msgs - read_msgs)
        # Last message for sidebar preview
        last = (
            Message.query
            .filter_by(room_id=r.id)
            .order_by(Message.created_at.desc())
            .first()
        )
        d["lastMessage"] = last.to_dict() if last else None
        d["isMuted"] = r.id in muted_ids
        result.append(d)
    return jsonify(result)


@rooms_bp.route("/", methods=["POST"])
@jwt_required()
def create_room():
    me = User.query.get(int(get_jwt_identity()))
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    is_private = bool(data.get("isPrivate", False))
    member_ids = data.get("memberIds", [])

    if is_private:
        if len(member_ids) != 1:
            return jsonify({"error": "DM requires exactly one other user"}), 400
        other_id = member_ids[0]
        other = User.query.get_or_404(other_id)
        existing = (
            Room.query
            .filter_by(is_private=True, created_by=me.id)
            .join(room_members, Room.id == room_members.c.room_id)
            .filter(room_members.c.user_id == other_id)
            .first()
        )
        if not existing:
            existing = (
                Room.query
                .filter_by(is_private=True, created_by=other_id)
                .join(room_members, Room.id == room_members.c.room_id)
                .filter(room_members.c.user_id == me.id)
                .first()
            )
        if existing:
            return jsonify(existing.to_dict(current_user_id=me.id)), 200

        room = Room(is_private=True, created_by=me.id)
        room.members = [me, other]
    else:
        if not name:
            return jsonify({"error": "Group room name is required"}), 400
        members = User.query.filter(User.id.in_(member_ids)).all()
        if me not in members:
            members.append(me)
        room = Room(name=name, description=data.get("description", ""),
                    is_private=False, created_by=me.id)
        room.members = members

    db.session.add(room)
    db.session.commit()
    return jsonify(room.to_dict(current_user_id=me.id)), 201


@rooms_bp.route("/<int:room_id>", methods=["GET"])
@jwt_required()
def get_room(room_id):
    me = User.query.get(int(get_jwt_identity()))
    room = Room.query.get_or_404(room_id)
    if me not in room.members:
        return jsonify({"error": "Forbidden"}), 403
    return jsonify(room.to_dict(current_user_id=me.id))


@rooms_bp.route("/<int:room_id>/members", methods=["POST"])
@jwt_required()
def add_member(room_id):
    me = User.query.get(int(get_jwt_identity()))
    room = Room.query.get_or_404(room_id)
    if me not in room.members or room.is_private:
        return jsonify({"error": "Forbidden"}), 403
    data = request.get_json() or {}
    user = User.query.get_or_404(data.get("userId"))
    if user not in room.members:
        room.members.append(user)
        db.session.commit()
    return jsonify(room.to_dict(current_user_id=me.id))


@rooms_bp.route("/<int:room_id>/kick", methods=["POST"])
@jwt_required()
def kick_member(room_id):
    """Kick a member from a group room (creator only)."""
    me = User.query.get(int(get_jwt_identity()))
    room = Room.query.get_or_404(room_id)
    if room.is_private or room.created_by != me.id:
        return jsonify({"error": "Only the room creator can kick members"}), 403
    data = request.get_json() or {}
    user = User.query.get_or_404(data.get("userId"))
    if user.id == me.id:
        return jsonify({"error": "Cannot kick yourself"}), 400
    if user in room.members:
        room.members.remove(user)
        db.session.commit()
    return jsonify(room.to_dict(current_user_id=me.id))


@rooms_bp.route("/<int:room_id>/leave", methods=["POST"])
@jwt_required()
def leave_room(room_id):
    me = User.query.get(int(get_jwt_identity()))
    room = Room.query.get_or_404(room_id)
    if me in room.members:
        room.members.remove(me)
        db.session.commit()
    return jsonify({"message": "Left room"})


# --------------------------------------------------------------------------- #
#  Pinned Messages                                                             #
# --------------------------------------------------------------------------- #
@rooms_bp.route("/<int:room_id>/pins", methods=["GET"])
@jwt_required()
def get_pins(room_id):
    me = User.query.get(int(get_jwt_identity()))
    room = Room.query.get_or_404(room_id)
    if me not in room.members:
        return jsonify({"error": "Forbidden"}), 403
    pins = (
        PinnedMessage.query.filter_by(room_id=room_id)
        .order_by(PinnedMessage.pinned_at.desc())
        .all()
    )
    return jsonify([{
        "id": p.id,
        "message": p.message.to_dict(),
        "pinnedBy": p.user.to_dict() if p.user else None,
        "pinnedAt": p.pinned_at.isoformat(),
    } for p in pins])


@rooms_bp.route("/<int:room_id>/pin", methods=["POST"])
@jwt_required()
def pin_message(room_id):
    me = User.query.get(int(get_jwt_identity()))
    room = Room.query.get_or_404(room_id)
    if me not in room.members:
        return jsonify({"error": "Forbidden"}), 403
    data = request.get_json() or {}
    msg_id = data.get("messageId")
    msg = Message.query.get_or_404(msg_id)
    if msg.room_id != room_id:
        return jsonify({"error": "Message not in this room"}), 400
    existing = PinnedMessage.query.filter_by(message_id=msg_id, room_id=room_id).first()
    if existing:
        return jsonify({"message": "Already pinned"}), 200
    pin = PinnedMessage(message_id=msg_id, room_id=room_id, pinned_by=me.id)
    db.session.add(pin)
    db.session.commit()
    return jsonify({"ok": True}), 201


@rooms_bp.route("/<int:room_id>/unpin", methods=["POST"])
@jwt_required()
def unpin_message(room_id):
    me = User.query.get(int(get_jwt_identity()))
    room = Room.query.get_or_404(room_id)
    if me not in room.members:
        return jsonify({"error": "Forbidden"}), 403
    data = request.get_json() or {}
    msg_id = data.get("messageId")
    pin = PinnedMessage.query.filter_by(message_id=msg_id, room_id=room_id).first()
    if pin:
        db.session.delete(pin)
        db.session.commit()
    return jsonify({"ok": True})


# --------------------------------------------------------------------------- #
#  Mute / Unmute Room                                                          #
# --------------------------------------------------------------------------- #
@rooms_bp.route("/<int:room_id>/mute", methods=["POST"])
@jwt_required()
def mute_room(room_id):
    me = User.query.get(int(get_jwt_identity()))
    Room.query.get_or_404(room_id)
    existing = MutedRoom.query.filter_by(room_id=room_id, user_id=me.id).first()
    if not existing:
        db.session.add(MutedRoom(room_id=room_id, user_id=me.id))
        db.session.commit()
    return jsonify({"muted": True})


@rooms_bp.route("/<int:room_id>/unmute", methods=["POST"])
@jwt_required()
def unmute_room(room_id):
    me = User.query.get(int(get_jwt_identity()))
    existing = MutedRoom.query.filter_by(room_id=room_id, user_id=me.id).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()
    return jsonify({"muted": False})


# --------------------------------------------------------------------------- #
#  Media Gallery                                                               #
# --------------------------------------------------------------------------- #
@rooms_bp.route("/<int:room_id>/media", methods=["GET"])
@jwt_required()
def get_media(room_id):
    """Return all file/image messages in a room for the media gallery."""
    me = User.query.get(int(get_jwt_identity()))
    room = Room.query.get_or_404(room_id)
    if me not in room.members:
        return jsonify({"error": "Forbidden"}), 403
    media = (
        Message.query
        .filter_by(room_id=room_id, is_deleted=False)
        .filter(Message.message_type.in_(["image", "file", "voice"]))
        .order_by(Message.created_at.desc())
        .limit(100)
        .all()
    )
    return jsonify([m.to_dict() for m in media])
