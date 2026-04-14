from fastapi.testclient import TestClient


def test_comments_and_votes(client: TestClient) -> None:
    e = client.post("/api/elements", json={"title": "t"}).json()
    eid = e["id"]

    r = client.post(f"/api/elements/{eid}/comments", json={"author": "a", "body": "hello"})
    assert r.status_code == 200
    assert r.json()["body"] == "hello"

    r = client.get(f"/api/elements/{eid}/comments")
    assert len(r.json()) == 1

    r = client.put(f"/api/elements/{eid}/votes", json={"voter_id": "v1", "value": 1})
    assert r.status_code == 200
    assert r.json()["value"] == 1

    r = client.put(f"/api/elements/{eid}/votes", json={"voter_id": "v1", "value": -1})
    assert r.status_code == 200
    assert r.json()["value"] == -1

    r = client.put(f"/api/elements/{eid}/votes", json={"voter_id": "v1", "value": 0})
    assert r.status_code == 204

    r = client.get(f"/api/elements/{eid}/votes")
    assert r.json() == []
