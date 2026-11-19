from .conftest import auth, register, socket_client


def test_dm_is_created_once(client, two_users):
    (a_id, a_tok), (b_id, _) = two_users
    r1 = client.post("/api/rooms/", json={"isPrivate": True, "memberIds": [b_id]}, headers=auth(a_tok))
    r2 = client.post("/api/rooms/", json={"isPrivate": True, "memberIds": [b_id]}, headers=auth(a_tok))
    assert r1.status_code == 201 and r2.status_code == 200
    assert r1.get_json()["id"] == r2.get_json()["id"]


def test_group_room_requires_name(client, two_users):
    (_, a_tok), (b_id, _) = two_users
    assert client.post("/api/rooms/", json={"memberIds": [b_id]}, headers=auth(a_tok)).status_code == 400
    r = client.post("/api/rooms/", json={"name": "Team", "memberIds": [b_id]}, headers=auth(a_tok))
    assert r.status_code == 201


def test_realtime_message_reaches_the_other_member(app, client, two_users):
    (a_id, a_tok), (b_id, b_tok) = two_users
    room = client.post("/api/rooms/", json={"isPrivate": True, "memberIds": [b_id]}, headers=auth(a_tok)).get_json()

    asha = socket_client(app, client, a_tok)
    ravi = socket_client(app, app.test_client(), b_tok)
    assert asha.is_connected() and ravi.is_connected()
    ravi.get_received()  # drop connect events

    asha.emit("send_message", {"roomId": room["id"], "content": "hello ravi"})
    events = [e for e in ravi.get_received() if e["name"] == "new_message"]
    assert events and events[0]["args"][0]["content"] == "hello ravi"

    # stored, and visible through the REST history
    history = client.get(f"/api/messages/room/{room['id']}", headers=auth(b_tok)).get_json()
    contents = [m["content"] for m in (history["messages"] if isinstance(history, dict) else history)]
    assert "hello ravi" in contents


def test_non_member_cannot_post(app, client, two_users):
    (a_id, a_tok), (b_id, _) = two_users
    room = client.post("/api/rooms/", json={"isPrivate": True, "memberIds": [b_id]}, headers=auth(a_tok)).get_json()
    _, c_tok = register(client, "intruder")
    c = socket_client(app, client, c_tok)
    c.get_received()
    c.emit("send_message", {"roomId": room["id"], "content": "let me in"})
    errors = [e for e in c.get_received() if e["name"] == "error"]
    assert errors and "Not a member" in errors[0]["args"][0]["message"]


def test_socket_rejects_bad_token(app, client):
    c = socketio_client = socket_client(app, client, "not-a-real-token")
    assert not socketio_client.is_connected()
    del c


def test_typing_indicator_is_broadcast(app, client, two_users):
    (a_id, a_tok), (b_id, b_tok) = two_users
    room = client.post("/api/rooms/", json={"isPrivate": True, "memberIds": [b_id]}, headers=auth(a_tok)).get_json()
    asha = socket_client(app, client, a_tok)
    ravi = socket_client(app, app.test_client(), b_tok)
    ravi.get_received()
    asha.emit("typing_start", {"roomId": room["id"]})
    names = [e["name"] for e in ravi.get_received()]
    assert any("typing" in n for n in names)


def test_timestamps_are_utc_with_offset(client, two_users):
    """Regression: naive timestamps made new messages show as '5 hours ago' in India."""
    (_, a_tok), (b_id, _) = two_users
    me = client.get("/api/auth/me", headers=auth(a_tok)).get_json()
    assert me["createdAt"].endswith("Z")
    room = client.post("/api/rooms/", json={"name": "Team", "memberIds": [b_id]}, headers=auth(a_tok)).get_json()
    assert room["createdAt"].endswith("Z")
