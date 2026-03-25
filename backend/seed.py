"""
Run with: python seed.py
Creates tables and optionally seeds demo users + a general room.
"""
import os
from dotenv import load_dotenv
load_dotenv()

from app import create_app
from app.config import DevelopmentConfig
from app.extensions import db
from app.models import User, Room

app = create_app(DevelopmentConfig)

with app.app_context():
    db.create_all()
    print("✅ Tables created")

    if os.getenv("SEED_DEMO", "false").lower() == "true":
        alice = User(username="alice", email="alice@demo.com")
        alice.set_password("password123")
        bob = User(username="bob", email="bob@demo.com")
        bob.set_password("password123")
        db.session.add_all([alice, bob])
        db.session.flush()

        general = Room(name="# general", description="Welcome to ChatApp!", created_by=alice.id)
        general.members = [alice, bob]
        db.session.add(general)
        db.session.commit()
        print("✅ Demo users (alice, bob) and #general room created")
