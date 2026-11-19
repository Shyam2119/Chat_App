import os
import sys

os.environ.setdefault("SOCKETIO_ASYNC_MODE", "threading")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest  # noqa: E402

from app import create_app, socketio  # noqa: E402
from app.config import TestConfig  # noqa: E402
from app.extensions import db  # noqa: E402


@pytest.fixture(scope="session")
def _app():
    # One app per test session: Flask-SocketIO keeps a single server object, so
    # building a new app for every test would leave earlier socket clients attached
    # to a stale server.
    return create_app(TestConfig)


_open_sockets = []


@pytest.fixture()
def app(_app):
    with _app.app_context():
        db.drop_all()
        db.create_all()
        yield _app
        for s in _open_sockets:
            if s.is_connected():
                s.disconnect()
        _open_sockets.clear()
        db.session.remove()


@pytest.fixture()
def client(app):
    return app.test_client()


def register(client, name):
    r = client.post("/api/auth/register", json={"username": name, "email": f"{name}@example.com", "password": "secret123"})
    assert r.status_code == 201, r.get_json()
    body = r.get_json()
    return body["user"]["id"], body["accessToken"]


@pytest.fixture()
def two_users(client):
    a_id, a_tok = register(client, "asha")
    b_id, b_tok = register(client, "ravi")
    return (a_id, a_tok), (b_id, b_tok)


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def socket_client(app, client, token):
    s = socketio.test_client(app, flask_test_client=client, auth={"token": token})
    _open_sockets.append(s)
    return s
