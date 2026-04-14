from fastapi.testclient import TestClient


def test_graph_load_and_traverse(client: TestClient) -> None:
    a = client.post("/api/elements", json={"title": "A"}).json()
    b = client.post("/api/elements", json={"title": "B"}).json()
    c = client.post("/api/elements", json={"title": "C"}).json()
    client.post(
        "/api/relations",
        json={"parent_id": a["id"], "child_id": b["id"], "relation_type": "contains"},
    )
    client.post(
        "/api/relations",
        json={"parent_id": b["id"], "child_id": c["id"], "relation_type": "contains"},
    )

    r = client.get(f"/api/graph/elements/{c['id']}/load", params={"depth": 3, "direction": "both"})
    assert r.status_code == 200
    data = r.json()
    ids = {n["id"] for n in data["nodes"]}
    assert a["id"] in ids and b["id"] in ids and c["id"] in ids

    tr = client.get(
        f"/api/graph/elements/{c['id']}/traverse",
        params={"direction": "upstream", "max_depth": 5},
    )
    assert tr.status_code == 200
    assert tr.json()["direction"] == "upstream"


def test_multi_parent(client: TestClient) -> None:
    p1 = client.post("/api/elements", json={"title": "p1"}).json()
    p2 = client.post("/api/elements", json={"title": "p2"}).json()
    ch = client.post("/api/elements", json={"title": "child"}).json()
    client.post("/api/relations", json={"parent_id": p1["id"], "child_id": ch["id"], "relation_type": "a"})
    client.post("/api/relations", json={"parent_id": p2["id"], "child_id": ch["id"], "relation_type": "b"})
    up = client.get(f"/api/relations/by-element/{ch['id']}/upstream").json()
    assert len(up) == 2


def test_forbid_cycles(client: TestClient) -> None:
    a = client.post("/api/elements", json={"title": "a"}).json()
    b = client.post("/api/elements", json={"title": "b"}).json()
    client.post("/api/relations", json={"parent_id": a["id"], "child_id": b["id"], "relation_type": "x"})
    r = client.post(
        "/api/relations",
        params={"forbid_cycles": "true"},
        json={"parent_id": b["id"], "child_id": a["id"], "relation_type": "y"},
    )
    assert r.status_code == 400
