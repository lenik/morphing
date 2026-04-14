from fastapi.testclient import TestClient


def test_story_script_storyboard_shot_pipeline(client: TestClient) -> None:
    ch = client.post("/api/elements", json={"title": "Hero", "type_hint": "Character", "content": "Brave."}).json()
    sc = client.post("/api/elements", json={"title": "Forest", "type_hint": "Scene", "content": "Dark woods."}).json()
    story = client.post(
        "/api/composer/stories",
        json={
            "title": "Quest",
            "character_ids": [ch["id"]],
            "scene_ids": [sc["id"]],
            "actions": [{"text": "They enter the woods."}],
        },
    )
    assert story.status_code == 200
    sid = story.json()["id"]

    script = client.post(f"/api/composer/stories/{sid}/derive-script")
    assert script.status_code == 200
    assert script.json()["type_hint"] == "Script"

    sb = client.post(f"/api/storyboards/from-script/{script.json()['id']}", params={"title": "SB1"})
    assert sb.status_code == 200
    sbid = sb.json()["id"]

    shot = client.post(
        f"/api/storyboards/{sbid}/shots",
        json={"title": "Wide", "body": "Establish forest", "order": 0},
    )
    assert shot.status_code == 200

    shots = client.get(f"/api/storyboards/{sbid}/shots")
    assert len(shots.json()) == 1


def test_versions_and_dependency_mark(client: TestClient) -> None:
    a = client.post("/api/elements", json={"title": "root"}).json()
    b = client.post("/api/elements", json={"title": "leaf"}).json()
    client.post("/api/relations", json={"parent_id": a["id"], "child_id": b["id"], "relation_type": "x"})
    client.patch(f"/api/elements/{a['id']}", json={"title": "root2"})
    leaf = client.get(f"/api/elements/{b['id']}").json()
    assert leaf["metadata"].get("outdated") is True

    hist = client.get(f"/api/elements/{a['id']}/versions")
    assert hist.status_code == 200
    assert len(hist.json()) >= 1


def test_ai_morph_visual_creator(client: TestClient) -> None:
    el = client.post("/api/elements", json={"title": "t", "type_hint": "Character", "content": "A warrior"}).json()
    ex = client.post(f"/api/ai/extract/{el['id']}", json={"text": None})
    assert ex.status_code == 200
    assert "slots" in ex.json()

    mp = client.post(f"/api/morph/preview/{el['id']}", json={"change_note": "armor"})
    assert mp.status_code == 200
    assert mp.json().get("ok") is True

    shot = client.post(
        "/api/elements",
        json={"title": "s", "type_hint": "Shot", "content": "A tree"},
    ).json()
    pr = client.post(f"/api/visual/prompts/shot/{shot['id']}")
    assert pr.status_code == 200
    assert pr.json().get("ok") is True

    client.patch(f"/api/elements/{el['id']}", json={"tags": ["marketplace"]})
    m = client.get("/api/creators/marketplace/list", params={"tag": "marketplace"})
    assert m.status_code == 200
