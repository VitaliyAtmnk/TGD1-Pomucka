def test_health(client):
    r = client.get("/api/health")
    assert r.json()["items"] == 2


def test_search_is_diacritics_insensitive(client):
    hits = client.get("/api/search", params={"q": "sit"}).json()
    assert hits[0]["id"] == "def-sit"
    assert hits[0]["chapter"]["id"] == "test"
    assert client.get("/api/search", params={"q": "max-flow"}).json()[0]["id"] == "thm-ford-fulkerson"


def test_item_detail_has_backlinks(client):
    d = client.get("/api/items/def-sit").json()
    assert [x["id"] for x in d["referenced_by"]] == ["thm-ford-fulkerson"]
    assert d["exam_questions"] == [6]


def test_auth_flow(client, auth):
    assert client.get("/api/auth/me", headers=auth).json()["email"] == "a@b.cz"
    assert client.post("/api/auth/login", json={"email": "A@b.cz", "password": "heslo12345"}).status_code == 200
    assert client.post("/api/auth/login", json={"email": "a@b.cz", "password": "spatne"}).status_code == 401
    r = client.post("/api/auth/register", json={"email": "a@b.cz", "password": "heslo12345", "display_name": "X"})
    assert r.status_code == 409
    assert client.get("/api/progress/summary").status_code == 401


def test_srs_and_summary(client, auth):
    q = client.get("/api/srs/queue", headers=auth).json()
    assert q["new_count"] == 2 and len(q["cards"]) == 2
    r = client.post("/api/srs/review", json={"item_id": "def-sit", "grade": 4}, headers=auth)
    assert r.json()["repetitions"] == 1 and r.json()["interval_days"] == 1
    q = client.get("/api/srs/queue", headers=auth).json()
    assert q["new_count"] == 1 and q["due_count"] == 0
    client.post("/api/progress/attempts", json={"kind": "quiz", "chapter_id": "test", "ref_id": "q-test-1", "correct": True}, headers=auth)
    client.post("/api/progress/attempts", json={"kind": "exam", "ref_id": "6", "correct": True, "score": 0.8}, headers=auth)
    s = client.get("/api/progress/summary", headers=auth).json()
    ch = s["chapters"][0]
    assert ch["cards_learned"] == 1 and ch["quiz_accuracy"] == 1.0
    assert 0 < ch["mastery"] < 1
    assert s["exam"][0]["last_score"] == 0.8
    assert s["streak_days"] == 1


def test_graphs_crud(client, auth):
    g = client.post("/api/graphs", json={"name": "K3", "data": {"nodes": [{"id": 1}], "edges": []}}, headers=auth).json()
    assert client.get("/api/graphs", headers=auth).json()[0]["name"] == "K3"
    client.put(f"/api/graphs/{g['id']}", json={"name": "K4", "data": {"nodes": [], "edges": []}}, headers=auth)
    assert client.get("/api/graphs", headers=auth).json()[0]["name"] == "K4"
    assert client.delete(f"/api/graphs/{g['id']}", headers=auth).status_code == 204


def test_delete_account(client, auth):
    assert client.delete("/api/auth/me", headers=auth).status_code == 204
    assert client.get("/api/auth/me", headers=auth).status_code == 401
