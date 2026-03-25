from datetime import datetime, timezone
import bcrypt
from .extensions import db

# --------------------------------------------------------------------------- #
#  Association table: room ↔ user (many-to-many)                              #
# --------------------------------------------------------------------------- #
room_members = db.Table(
    "room_members",
    db.Column("room_id", db.Integer, db.ForeignKey("rooms.id"), primary_key=True),
    db.Column("user_id", db.Integer, db.ForeignKey("users.id"), primary_key=True),
    db.Column("joined_at", db.DateTime, default=lambda: datetime.now(timezone.utc)),
    db.Column("is_admin", db.Boolean, default=False),
)


# --------------------------------------------------------------------------- #
#  User                                                                        #
# --------------------------------------------------------------------------- #
class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    avatar_url = db.Column(db.String(255), nullable=True)
    bio = db.Column(db.String(200), nullable=True)
    status_text = db.Column(db.String(100), nullable=True)        # custom status
    status_emoji = db.Column(db.String(10), nullable=True)        # status emoji
    is_online = db.Column(db.Boolean, default=False)
    last_seen = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    theme = db.Column(db.String(10), default="dark")              # dark | light

    # Relationships
    rooms = db.relationship("Room", secondary=room_members, back_populates="members")
    messages = db.relationship("Message", back_populates="sender", lazy="dynamic")
    read_receipts = db.relationship("ReadReceipt", back_populates="user", lazy="dynamic")
    starred_messages = db.relationship("StarredMessage", back_populates="user", lazy="dynamic")

    def set_password(self, password: str):
        salt = bcrypt.gensalt()
        self.password_hash = bcrypt.hashpw(password.encode(), salt).decode()

    def check_password(self, password: str) -> bool:
        return bcrypt.checkpw(password.encode(), self.password_hash.encode())

    def to_dict(self, include_email=False):
        d = {
            "id": self.id,
            "username": self.username,
            "avatarUrl": self.avatar_url,
            "bio": self.bio,
            "statusText": self.status_text,
            "statusEmoji": self.status_emoji,
            "isOnline": self.is_online,
            "lastSeen": self.last_seen.isoformat() if self.last_seen else None,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "theme": self.theme,
        }
        if include_email:
            d["email"] = self.email
        return d


# --------------------------------------------------------------------------- #
#  Room                                                                        #
# --------------------------------------------------------------------------- #
class Room(db.Model):
    __tablename__ = "rooms"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=True)          # None → private DM
    description = db.Column(db.String(300), nullable=True)
    is_private = db.Column(db.Boolean, default=False)        # True = DM
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    members = db.relationship("User", secondary=room_members, back_populates="rooms")
    messages = db.relationship("Message", back_populates="room",
                               lazy="dynamic", cascade="all, delete-orphan")
    pinned_messages = db.relationship("PinnedMessage", back_populates="room",
                                      lazy="dynamic", cascade="all, delete-orphan")
    muted_by = db.relationship("MutedRoom", back_populates="room",
                                lazy="dynamic", cascade="all, delete-orphan")
    creator = db.relationship("User", foreign_keys=[created_by])

    def to_dict(self, current_user_id=None):
        d = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "isPrivate": self.is_private,
            "createdBy": self.created_by,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "members": [m.to_dict() for m in self.members],
            "memberCount": len(self.members),
            "pinnedCount": self.pinned_messages.count() if self.pinned_messages else 0,
        }
        # For DMs expose the *other* person's name as room name
        if self.is_private and current_user_id:
            other = next((m for m in self.members if m.id != current_user_id), None)
            if other:
                d["name"] = other.username
                d["avatarUrl"] = other.avatar_url
                d["otherUser"] = other.to_dict()
        return d


# --------------------------------------------------------------------------- #
#  Message                                                                     #
# --------------------------------------------------------------------------- #
class Message(db.Model):
    __tablename__ = "messages"

    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    message_type = db.Column(db.String(20), default="text")  # text | image | file | voice | forwarded
    room_id = db.Column(db.Integer, db.ForeignKey("rooms.id"), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    reply_to_id = db.Column(db.Integer, db.ForeignKey("messages.id"), nullable=True)
    forwarded_from_id = db.Column(db.Integer, db.ForeignKey("messages.id"), nullable=True)
    file_url = db.Column(db.String(500), nullable=True)
    file_name = db.Column(db.String(255), nullable=True)
    file_size = db.Column(db.Integer, nullable=True)
    is_edited = db.Column(db.Boolean, default=False)
    is_deleted = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    room = db.relationship("Room", back_populates="messages")
    sender = db.relationship("User", back_populates="messages")
    read_receipts = db.relationship("ReadReceipt", back_populates="message",
                                    lazy="dynamic", cascade="all, delete-orphan")
    reactions = db.relationship("MessageReaction", back_populates="message",
                                lazy="dynamic", cascade="all, delete-orphan")
    reply_to = db.relationship("Message", remote_side="Message.id",
                                foreign_keys=[reply_to_id])
    forwarded_from = db.relationship("Message", remote_side="Message.id",
                                      foreign_keys=[forwarded_from_id])

    def to_dict(self):
        # Group reactions by emoji: { "👍": [userId1, userId2], ... }
        reaction_groups: dict[str, list[int]] = {}
        for r in self.reactions:
            if r.emoji not in reaction_groups:
                reaction_groups[r.emoji] = []
            reaction_groups[r.emoji].append(r.user_id)

        # Build reply-to snippet (avoid recursive to_dict calls)
        reply_to_data = None
        if self.reply_to:
            reply_to_data = {
                "id": self.reply_to.id,
                "content": self.reply_to.content if not self.reply_to.is_deleted else "[Message deleted]",
                "senderId": self.reply_to.sender_id,
                "sender": self.reply_to.sender.to_dict() if self.reply_to.sender else None,
            }

        # Build forwarded-from snippet
        forwarded_data = None
        if self.forwarded_from:
            forwarded_data = {
                "id": self.forwarded_from.id,
                "content": self.forwarded_from.content,
                "sender": self.forwarded_from.sender.to_dict() if self.forwarded_from.sender else None,
            }

        return {
            "id": self.id,
            "content": self.content if not self.is_deleted else "[Message deleted]",
            "messageType": self.message_type,
            "roomId": self.room_id,
            "senderId": self.sender_id,
            "sender": self.sender.to_dict() if self.sender else None,
            "replyToId": self.reply_to_id,
            "replyTo": reply_to_data,
            "forwardedFromId": self.forwarded_from_id,
            "forwardedFrom": forwarded_data,
            "fileUrl": self.file_url,
            "fileName": self.file_name,
            "fileSize": self.file_size,
            "isEdited": self.is_edited,
            "isDeleted": self.is_deleted,
            "readBy": [r.user_id for r in self.read_receipts],
            "reactions": reaction_groups,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }


# --------------------------------------------------------------------------- #
#  Read Receipt                                                                #
# --------------------------------------------------------------------------- #
class ReadReceipt(db.Model):
    __tablename__ = "read_receipts"

    id = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(db.Integer, db.ForeignKey("messages.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    read_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    message = db.relationship("Message", back_populates="read_receipts")
    user = db.relationship("User", back_populates="read_receipts")

    __table_args__ = (db.UniqueConstraint("message_id", "user_id"),)


# --------------------------------------------------------------------------- #
#  Message Reaction                                                            #
# --------------------------------------------------------------------------- #
class MessageReaction(db.Model):
    __tablename__ = "message_reactions"

    id = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(db.Integer, db.ForeignKey("messages.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    emoji = db.Column(db.String(10), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    message = db.relationship("Message", back_populates="reactions")
    user = db.relationship("User")

    __table_args__ = (db.UniqueConstraint("message_id", "user_id", "emoji"),)


# --------------------------------------------------------------------------- #
#  Pinned Message                                                              #
# --------------------------------------------------------------------------- #
class PinnedMessage(db.Model):
    __tablename__ = "pinned_messages"

    id = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(db.Integer, db.ForeignKey("messages.id"), nullable=False)
    room_id = db.Column(db.Integer, db.ForeignKey("rooms.id"), nullable=False)
    pinned_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    pinned_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    message = db.relationship("Message")
    room = db.relationship("Room", back_populates="pinned_messages")
    user = db.relationship("User")

    __table_args__ = (db.UniqueConstraint("message_id", "room_id"),)


# --------------------------------------------------------------------------- #
#  Starred Message (per-user bookmarks)                                        #
# --------------------------------------------------------------------------- #
class StarredMessage(db.Model):
    __tablename__ = "starred_messages"

    id = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(db.Integer, db.ForeignKey("messages.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    starred_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    message = db.relationship("Message")
    user = db.relationship("User", back_populates="starred_messages")

    __table_args__ = (db.UniqueConstraint("message_id", "user_id"),)


# --------------------------------------------------------------------------- #
#  Muted Room (notification preferences)                                       #
# --------------------------------------------------------------------------- #
class MutedRoom(db.Model):
    __tablename__ = "muted_rooms"

    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(db.Integer, db.ForeignKey("rooms.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    muted_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    room = db.relationship("Room", back_populates="muted_by")
    user = db.relationship("User")

    __table_args__ = (db.UniqueConstraint("room_id", "user_id"),)
