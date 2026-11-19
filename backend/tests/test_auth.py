from .conftest import auth, register


def test_register_login_me(client):
    user_id, token = register(client, "asha")
    r = client.post("/api/auth/login", json={"email": "asha@example.com", "password": "secret123"})
    assert r.status_code == 200 and r.get_json()["user"]["id"] == user_id
    me = client.get("/api/auth/me", headers=auth(token)).get_json()
    assert me["username"] == "asha" and me["email"] == "asha@example.com"


def test_password_is_hashed(app, client):
    from app.models import User
    register(client, "asha")
    user = User.query.filter_by(username="asha").first()
    assert "secret123" not in (user.password_hash or "")


def test_login_by_username_and_wrong_password(client):
    register(client, "asha")
    assert client.post("/api/auth/login", json={"username": "asha", "password": "secret123"}).status_code == 200
    assert client.post("/api/auth/login", json={"username": "asha", "password": "wrong-pass"}).status_code == 401


def test_validation_and_duplicates(client):
    assert client.post("/api/auth/register", json={"username": "x"}).status_code == 400
    assert client.post("/api/auth/register", json={"username": "x", "email": "x@e.com", "password": "123"}).status_code == 400
    register(client, "asha")
    r = client.post("/api/auth/register", json={"username": "asha", "email": "other@e.com", "password": "secret123"})
    assert r.status_code == 409


def test_protected_routes_need_a_token(client):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/rooms/").status_code == 401


def test_refresh_token(client):
    r = client.post("/api/auth/register", json={"username": "asha", "email": "a@e.com", "password": "secret123"})
    refresh = r.get_json()["refreshToken"]
    r2 = client.post("/api/auth/refresh", headers=auth(refresh))
    assert r2.status_code == 200 and r2.get_json()["accessToken"]
