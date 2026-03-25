from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import Message, Room, User, ReadReceipt, StarredMessage

messages_bp = Blueprint("messages", __name__)


@messages_bp.route("/room/<int:room_id>", methods=["GET"])
@jwt_required()
def get_messages(room_id):
    me = User.query.get(int(get_jwt_identity()))
    room = Room.query.get_or_404(room_id)
    if me not in room.members:
        return jsonify({"error": "Forbidden"}), 403

    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("perPage", 50, type=int), 100)
    pagination = (
        room.messages
        .order_by(Message.created_at.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )
    messages = list(reversed(pagination.items))

    # Get user's starred message IDs for this batch
    msg_ids = [m.id for m in messages]
    starred_ids = set(
        s.message_id for s in StarredMessage.query
        .filter(StarredMessage.user_id == me.id, StarredMessage.message_id.in_(msg_ids))
        .all()
    ) if msg_ids else set()

    result = []
    for m in messages:
        d = m.to_dict()
        d["isStarred"] = m.id in starred_ids
        result.append(d)

    return jsonify({
        "messages": result,
        "total": pagination.total,
        "pages": pagination.pages,
        "page": page,
    })


@messages_bp.route("/<int:message_id>", methods=["PATCH"])
@jwt_required()
def edit_message(message_id):
    me = User.query.get(int(get_jwt_identity()))
    msg = Message.query.get_or_404(message_id)
    if msg.sender_id != me.id:
        return jsonify({"error": "Forbidden"}), 403
    if msg.is_deleted:
        return jsonify({"error": "Cannot edit a deleted message"}), 400
    data = request.get_json() or {}
    content = (data.get("content") or "").strip()
    if not content:
        return jsonify({"error": "Content required"}), 400
    msg.content = content
    msg.is_edited = True
    db.session.commit()       # commit first so updatedAt is fresh
    return jsonify(msg.to_dict())


@messages_bp.route("/<int:message_id>", methods=["DELETE"])
@jwt_required()
def delete_message(message_id):
    me = User.query.get(int(get_jwt_identity()))
    msg = Message.query.get_or_404(message_id)
    if msg.sender_id != me.id:
        return jsonify({"error": "Forbidden"}), 403
    msg.is_deleted = True
    db.session.commit()       # commit first so updatedAt is fresh
    return jsonify(msg.to_dict())


@messages_bp.route("/<int:message_id>/read", methods=["POST"])
@jwt_required()
def mark_read(message_id):
    me = User.query.get(int(get_jwt_identity()))
    msg = Message.query.get_or_404(message_id)
    existing = ReadReceipt.query.filter_by(
        message_id=message_id, user_id=me.id
    ).first()
    if not existing:
        receipt = ReadReceipt(message_id=message_id, user_id=me.id)
        db.session.add(receipt)
        db.session.commit()
    return jsonify({"ok": True})


@messages_bp.route("/search", methods=["GET"])
@jwt_required()
def search_messages():
    me = User.query.get(int(get_jwt_identity()))
    q = request.args.get("q", "").strip()
    room_id = request.args.get("roomId", type=int)
    if not q or not room_id:
        return jsonify({"messages": [], "total": 0})

    room = Room.query.get_or_404(room_id)
    if me not in room.members:
        return jsonify({"error": "Forbidden"}), 403

    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("perPage", 20, type=int), 50)
    pagination = (
        Message.query
        .filter_by(room_id=room_id, is_deleted=False)
        .filter(Message.content.ilike(f"%{q}%"))
        .order_by(Message.created_at.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )
    return jsonify({
        "messages": [m.to_dict() for m in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages,
        "page": page,
    })


# --------------------------------------------------------------------------- #
#  Star / Unstar                                                               #
# --------------------------------------------------------------------------- #
@messages_bp.route("/<int:message_id>/star", methods=["POST"])
@jwt_required()
def star_message(message_id):
    me = User.query.get(int(get_jwt_identity()))
    Message.query.get_or_404(message_id)
    existing = StarredMessage.query.filter_by(
        message_id=message_id, user_id=me.id
    ).first()
    if not existing:
        db.session.add(StarredMessage(message_id=message_id, user_id=me.id))
        db.session.commit()
    return jsonify({"starred": True})


@messages_bp.route("/<int:message_id>/unstar", methods=["POST"])
@jwt_required()
def unstar_message(message_id):
    me = User.query.get(int(get_jwt_identity()))
    existing = StarredMessage.query.filter_by(
        message_id=message_id, user_id=me.id
    ).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()
    return jsonify({"starred": False})


@messages_bp.route("/starred", methods=["GET"])
@jwt_required()
def get_starred():
    me = User.query.get(int(get_jwt_identity()))
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("perPage", 30, type=int), 50)
    pagination = (
        StarredMessage.query
        .filter_by(user_id=me.id)
        .order_by(StarredMessage.starred_at.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )
    return jsonify({
        "messages": [{
            "id": s.id,
            "message": s.message.to_dict(),
            "starredAt": s.starred_at.isoformat(),
        } for s in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages,
        "page": page,
    })


# --------------------------------------------------------------------------- #
#  Forward Message                                                             #
# --------------------------------------------------------------------------- #
@messages_bp.route("/<int:message_id>/forward", methods=["POST"])
@jwt_required()
def forward_message(message_id):
    me = User.query.get(int(get_jwt_identity()))
    original = Message.query.get_or_404(message_id)
    data = request.get_json() or {}
    target_room_id = data.get("roomId")
    if not target_room_id:
        return jsonify({"error": "roomId required"}), 400
    room = Room.query.get_or_404(target_room_id)
    if me not in room.members:
        return jsonify({"error": "Not a member of target room"}), 403

    fwd = Message(
        content=original.content,
        message_type="forwarded",
        room_id=target_room_id,
        sender_id=me.id,
        forwarded_from_id=original.id,
        file_url=original.file_url,
        file_name=original.file_name,
        file_size=original.file_size,
    )
    db.session.add(fwd)
    db.session.flush()
    fwd_dict = fwd.to_dict()
    db.session.commit()
    return jsonify(fwd_dict), 201


# --------------------------------------------------------------------------- #
#  File Upload (Base64)                                                        #
# --------------------------------------------------------------------------- #
@messages_bp.route("/upload", methods=["POST"])
@jwt_required()
def upload_file():
    """Accept a base64-encoded file and store it as a message in a room."""
    me = User.query.get(int(get_jwt_identity()))
    data = request.get_json() or {}
    room_id = data.get("roomId")
    file_data = data.get("fileData")       # base64 data URI
    file_name = data.get("fileName", "file")
    file_size = data.get("fileSize", 0)
    message_type = data.get("messageType", "file")  # image | file | voice

    if not room_id or not file_data:
        return jsonify({"error": "roomId and fileData are required"}), 400

    room = Room.query.get_or_404(room_id)
    if me not in room.members:
        return jsonify({"error": "Forbidden"}), 403

    msg = Message(
        content=file_name,
        message_type=message_type,
        room_id=room_id,
        sender_id=me.id,
        file_url=file_data,
        file_name=file_name,
        file_size=file_size,
    )
    db.session.add(msg)
    db.session.flush()  # get msg.id

    receipt = ReadReceipt(message_id=msg.id, user_id=me.id)
    db.session.add(receipt)
    msg_dict = msg.to_dict()
    db.session.commit()

    return jsonify(msg_dict), 201
