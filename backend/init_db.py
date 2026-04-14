import eventlet
eventlet.monkey_patch()

import os
from dotenv import load_dotenv
load_dotenv()

from app import create_app
from app.extensions import db

app = create_app()

with app.app_context():
    db.create_all()
    print("✅ All tables created successfully.")
    from sqlalchemy import inspect
    print("Tables:", inspect(db.engine).get_table_names())
