from fastapi.testclient import TestClient


def test_create_list_get_patch_delete_element(client: TestClient) -> None:
    r = client.post(
        "/api/elements",
        json={
            "title": "Idea A",
            "content": "body",
            "type_hint": "Idea",
            "tags": ["alpha", "beta"],
            "metadata": {"k": 1},
            "author": "u1",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["title"] == "Idea A"
    assert data["tags"] == ["alpha", "beta"]
    assert data["version"] == 1
    eid = data["id"]

    r = client.get("/api/elements")
    assert r.status_code == 200
    assert len(r.json()) == 1

    r = client.get(f"/api/elements/{eid}")
    assert r.status_code == 200
    assert r.json()["id"] == eid

    r = client.patch(f"/api/elements/{eid}", json={"title": "Idea B"})
    assert r.status_code == 200
    assert r.json()["title"] == "Idea B"
    assert r.json()["version"] == 2

    r = client.delete(f"/api/elements/{eid}")
    assert r.status_code == 204
    r = client.get(f"/api/elements/{eid}")
    assert r.status_code == 404


def test_list_filter_by_type_and_tag(client: TestClient) -> None:
    client.post(
        "/api/elements",
        json={"title": "x", "type_hint": "Character", "tags": ["hero"]},
    )
    client.post(
        "/api/elements",
        json={"title": "y", "type_hint": "Scene", "tags": ["hero", "night"]},
    )
    r = client.get("/api/elements", params={"type_hint": "Scene"})
    assert len(r.json()) == 1
    r = client.get("/api/elements", params={"tag": "night"})
    assert len(r.json()) == 1
    assert r.json()[0]["title"] == "y"
