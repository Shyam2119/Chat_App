import os
from app import create_app, socketio
from app.config import DevelopmentConfig, ProductionConfig

config = ProductionConfig if os.getenv("FLASK_ENV") == "production" else DevelopmentConfig
app = create_app(config)

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    socketio.run(app, host="0.0.0.0", port=port, debug=(config == DevelopmentConfig))
