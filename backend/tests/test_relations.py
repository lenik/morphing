from fastapi.testclient import TestClient


def test_relation_upstream_downstream(client: TestClient) -> None:
    p = client.post("/api/elements", json={"title": "parent"}).json()
    c = client.post("/api/elements", json={"title": "child"}).json()
    r = client.post(
        "/api/relations",
        json={"parent_id": p["id"], "child_id": c["id"], "relation_type": "contains"},
    )
    assert r.status_code == 200
    rel = r.json()
    assert rel["parent_id"] == p["id"]
    assert rel["child_id"] == c["id"]

    up = client.get(f"/api/relations/by-element/{c['id']}/upstream").json()
    assert len(up) == 1
    down = client.get(f"/api/relations/by-element/{p['id']}/downstream").json()
    assert len(down) == 1

    both = client.get(f"/api/relations/by-element/{p['id']}").json()
    assert len(both["upstream"]) == 0
    assert len(both["downstream"]) == 1

    r = client.delete(f"/api/relations/{rel['id']}")
    assert r.status_code == 204


def test_relation_rejects_self_loop(client: TestClient) -> None:
    p = client.post("/api/elements", json={"title": "solo"}).json()
    r = client.post(
        "/api/relations",
        json={"parent_id": p["id"], "child_id": p["id"], "relation_type": "x"},
    )
    assert r.status_code == 400
