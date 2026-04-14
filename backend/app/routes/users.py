from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import User

users_bp = Blueprint("users", __name__)


@users_bp.route("/", methods=["GET"])
@jwt_required()
def list_users():
    q = request.args.get("q", "").strip()
    query = User.query
    if q:
        # search by username OR email
        query = query.filter(
            User.username.ilike(f"%{q}%") | User.email.ilike(f"%{q}%")
        )
    users = query.filter(User.id != int(get_jwt_identity())).limit(30).all()
    return jsonify([u.to_dict() for u in users])


@users_bp.route("/<int:user_id>", methods=["GET"])
@jwt_required()
def get_user(user_id):
    user = User.query.get_or_404(user_id)
    return jsonify(user.to_dict())


@users_bp.route("/me", methods=["PATCH"])
@jwt_required()
def update_me():
    me = User.query.get_or_404(int(get_jwt_identity()))
    data = request.get_json() or {}
    if "bio" in data:
        me.bio = data["bio"][:200]
    if "avatarUrl" in data:
        me.avatar_url = data["avatarUrl"]
    if "statusText" in data:
        me.status_text = (data["statusText"] or "")[:100]
    if "statusEmoji" in data:
        me.status_emoji = (data["statusEmoji"] or "")[:10]
    if "theme" in data and data["theme"] in ("dark", "light"):
        me.theme = data["theme"]
    db.session.commit()
    return jsonify(me.to_dict(include_email=True))


@users_bp.route("/me/password", methods=["PATCH"])
@jwt_required()
def change_password():
    """Change current user's password (requires current password)."""
    me = User.query.get_or_404(int(get_jwt_identity()))
    data = request.get_json() or {}
    current_password = data.get("currentPassword") or ""
    new_password = data.get("newPassword") or ""

    if not current_password or not new_password:
        return jsonify({"error": "currentPassword and newPassword are required"}), 400
    if not me.check_password(current_password):
        return jsonify({"error": "Current password is incorrect"}), 401
    if len(new_password) < 6:
        return jsonify({"error": "New password must be at least 6 characters"}), 400
    if current_password == new_password:
        return jsonify({"error": "New password must differ from current password"}), 400

    me.set_password(new_password)
    db.session.commit()
    return jsonify({"message": "Password updated successfully"})
