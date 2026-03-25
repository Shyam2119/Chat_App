import eventlet
eventlet.monkey_patch()

from flask import Flask
from flask_socketio import SocketIO
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_migrate import Migrate
from .extensions import db
from .config import Config

socketio = SocketIO()
jwt = JWTManager()
migrate = Migrate()


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Init extensions
    db.init_app(app)
    jwt.init_app(app)
    migrate.init_app(app, db)
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
         supports_credentials=True)
    socketio.init_app(
        app,
        cors_allowed_origins=app.config["CORS_ORIGINS"],
        async_mode="eventlet",
        logger=False,
        engineio_logger=False,
        ping_timeout=60,
        ping_interval=25,
    )

    # Register blueprints
    from .routes.auth import auth_bp
    from .routes.users import users_bp
    from .routes.rooms import rooms_bp
    from .routes.messages import messages_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(rooms_bp, url_prefix="/api/rooms")
    app.register_blueprint(messages_bp, url_prefix="/api/messages")

    # Register socket events
    from . import socket_events  # noqa: F401

    @app.errorhandler(422)
    def handle_error_422(e):
        import logging
        logging.error(f"422 Error triggered: {e}")
        description = e.description if hasattr(e, 'description') else str(e)
        return {"error": "422 Unprocessable Entity", "details": description}, 422

    return app
