import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv(override=True)


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)

    # DB — prefers DATABASE_URL env var (Render injects this)
    _db_url = os.getenv("DATABASE_URL")
    if _db_url:
        SQLALCHEMY_DATABASE_URI = _db_url
    else:
        _host = os.getenv("DB_HOST", "localhost")
        _port = os.getenv("DB_PORT", "3306")
        _name = os.getenv("DB_NAME", "chatapp")
        _user = os.getenv("DB_USER", "root")
        _pass = os.getenv("DB_PASSWORD", "")
        SQLALCHEMY_DATABASE_URI = (
            f"mysql+pymysql://{_user}:{_pass}@{_host}:{_port}/{_name}"
        )

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")


class ProductionConfig(Config):
    DEBUG = False


class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "sqlite:///chatapp_dev.db"   # SQLite fallback for local dev
    )
