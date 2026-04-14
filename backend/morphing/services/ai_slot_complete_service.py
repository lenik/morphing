"""Fill metadata.slots from title/body using OpenAI or heuristics."""

from __future__ import annotations

import json
import re
from typing import Any

import httpx

from morphing.config import settings

# Subset of slot keys per type (matches frontend elementSlotsByType intent)
SLOT_KEYS_BY_TYPE: dict[str, list[str]] = {
    "Idea": [
        "working_title",
        "one_line_spark",
        "problem_or_tension",
        "intended_audience",
        "medium_or_format",
        "genre_tags",
        "central_question",
        "status",
        "priority",
        "next_action",
        "dependencies_notes",
        "success_criteria",
        "non_goals",
        "risks_and_unknowns",
        "references_inspirations",
        "competing_ideas",
        "hook_for_pitch",
        "open_threads",
    ],
    "Character": [
        "display_name",
        "aliases",
        "role_in_story",
        "age_band",
        "species_or_kind",
        "pronouns",
        "occupation",
        "appearance_overview",
        "face_and_gaze",
        "hair",
        "body_and_stature",
        "wardrobe_signature",
        "distinguishing_marks",
        "voice_accent",
        "personality_summary",
        "voice_tone",
        "voice_vocabulary",
        "core_desire",
        "core_fear",
        "moral_compass",
        "contradictions",
        "skills_and_limits",
        "relationships_overview",
        "family_and_origin",
        "faction_affiliations",
        "secrets",
        "backstory_origin",
        "backstory_turning_point",
        "arc_want",
        "arc_need",
        "arc_change",
        "entrance_and_exit",
        "casting_notes",
        "ref_visual_notes",
    ],
    "Scene": [
        "scene_label",
        "location_name",
        "location_type",
        "geography_notes",
        "time_of_day",
        "timeframe_story",
        "duration_estimate",
        "weather",
        "lighting",
        "color_palette",
        "soundscape",
        "mood",
        "pov",
        "tense",
        "beats_outline",
        "turning_beat",
        "props_key",
        "characters_present",
        "blocking_notes",
        "continuity_notes",
        "vfx_notes",
        "costume_notes",
    ],
    "Story": [
        "logline",
        "title_options",
        "genre",
        "tone",
        "theme",
        "thematic_question",
        "central_conflict",
        "antagonistic_forces",
        "stakes",
        "structure_model",
        "act_breakdown",
        "midpoint",
        "climax_notes",
        "resolution_notes",
        "subplots",
        "foreshadowing",
        "world_rules",
        "audience",
        "comparable_titles",
        "status",
        "revision_notes",
        "open_questions",
    ],
    "Script": [
        "format_standard",
        "revision_color",
        "page_target",
        "scene_numbering",
        "scene_outline_ref",
        "dialogue_style",
        "stage_directions_style",
        "character_voice_notes",
        "music_and_sound_cues",
        "vfx_annotations",
        "revision_notes",
        "table_read_notes",
        "coverage_notes",
        "legal_clearance",
    ],
    "Storyboard": [
        "aspect_ratio",
        "resolution_target",
        "frame_rate",
        "color_pipeline",
        "visual_style",
        "reference_films",
        "sequence_intent",
        "pacing_notes",
        "transition_policy",
        "audio_stems_plan",
        "notes",
        "review_status",
    ],
    "Shot": [
        "shot_code",
        "duration_sec",
        "camera_angle",
        "camera_height",
        "lens_mm",
        "movement",
        "framing",
        "focus_policy",
        "screen_direction",
        "eyeline",
        "blocking",
        "lighting_setup",
        "time_of_day",
        "production_design",
        "vfx_notes",
        "dialogue",
        "sfx",
        "music",
        "edit_notes",
    ],
    "Collection": ["collection_purpose", "notes"],
}


def _excerpt(text: str, max_len: int = 600) -> str:
    t = (text or "").strip()
    if len(t) <= max_len:
        return t
    return t[:max_len] + "…"


def _heuristic_slots(type_hint: str, title: str, content: str) -> dict[str, str]:
    keys = SLOT_KEYS_BY_TYPE.get(type_hint, SLOT_KEYS_BY_TYPE["Idea"])
    text = f"{title}\n{content}".strip()
    out: dict[str, str] = {}
    for i, k in enumerate(keys):
        out[k] = (text[: min(80 + i * 5, len(text))] if text else f"({k})")[:2000]
    return out


def _clamp_conf(v: Any, default: float = 0.65) -> float:
    try:
        n = float(v)
    except Exception:
        n = default
    return max(0.0, min(1.0, n))


def _heuristic_confidences(keys: list[str]) -> dict[str, float]:
    return {k: 0.56 for k in keys}


def _normalize_slot_value(v: Any) -> str:
    txt = str(v).strip() if v is not None else ""
    if not txt:
        return ""
    # Keep output compact and avoid giant noisy payloads.
    return txt[:2000]


def _trace_slot_fill(
    *,
    kind: str,
    model: str | None,
    type_hint: str,
    keys: list[str],
    title: str,
    content: str,
    assistant_excerpt: str,
    extra_note: str | None = None,
    llm_request: str | None = None,
) -> dict[str, Any]:
    key_prompt = (
        f"[Slot fill] type={type_hint}\n"
        f"[Keys] {keys}\n"
        f"[Title] {title}\n"
        f"[Body excerpt, {len(content or '')} chars total]\n{_excerpt(content, 500)}"
    )
    summary = f"{type_hint} · {kind}"
    if model:
        summary += f" · {model}"
    if extra_note:
        summary += f" · {extra_note}"
    out = {
        "kind": kind,
        "model": model,
        "summary": summary,
        "key_prompt": key_prompt,
        "assistant_excerpt": assistant_excerpt[:12000],
    }
    if llm_request:
        out["llm_request"] = llm_request
    return out


def _trace_morph(
    *,
    kind: str,
    model: str | None,
    target_type: str,
    suggested_title: str,
    member_text: str,
    assistant_excerpt: str,
    extra_note: str | None = None,
    llm_request: str | None = None,
) -> dict[str, Any]:
    key_prompt = (
        f"[Morph → {target_type}]\n"
        f"[Suggested title] {suggested_title}\n"
        f"[Source bundle excerpt, {len(member_text)} chars total]\n{_excerpt(member_text, 1200)}"
    )
    summary = f"morph → {target_type} · {kind}"
    if model:
        summary += f" · {model}"
    if extra_note:
        summary += f" · {extra_note}"
    out = {
        "kind": kind,
        "model": model,
        "summary": summary,
        "key_prompt": key_prompt,
        "assistant_excerpt": assistant_excerpt[:12000],
    }
    if llm_request:
        out["llm_request"] = llm_request
    return out


def _llm_request_preview(*, base_url: str, model: str, prompt: str) -> str:
    return json.dumps(
        {
            "url": f"{base_url.rstrip('/')}/chat/completions",
            "headers": {
                "Authorization": "Bearer <OPENAI_API_KEY>",
                "Content-Type": "application/json",
            },
            "body": {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {"type": "json_object"},
            },
        },
        ensure_ascii=False,
        indent=2,
    )


def complete_slots(
    *,
    title: str,
    type_hint: str,
    content: str,
    api_key: str | None,
    base_url: str | None,
    model: str | None,
    accept_confidence: float | None = None,
    allow_custom_facets: bool = True,
    show_complete_request_to_llm: bool = False,
) -> tuple[
    dict[str, str],
    dict[str, float],
    dict[str, str],
    dict[str, str],
    dict[str, float],
    dict[str, str],
    dict[str, Any],
]:
    keys = SLOT_KEYS_BY_TYPE.get(type_hint, SLOT_KEYS_BY_TYPE["Idea"])
    key = (api_key or "").strip() or (settings.openai_api_key or "").strip()
    b_url = (base_url or "").strip().rstrip("/") or settings.openai_base_url.rstrip("/")
    mdl = (model or "").strip() or settings.openai_default_model
    llm_preview = ""
    threshold = max(0.5, min(1.0, float(accept_confidence if accept_confidence is not None else 0.6)))
    llm_preview = ""

    if not key:
        slots = _heuristic_slots(type_hint, title, content)
        confidences = _heuristic_confidences(keys)
        accepted = {k: v for k, v in slots.items() if confidences.get(k, 0.0) >= threshold}
        extra_slots: dict[str, str] = {}
        extra_confidences: dict[str, float] = {}
        accepted_extra: dict[str, str] = {}
        trace = _trace_slot_fill(
            kind="heuristic",
            model=None,
            type_hint=type_hint,
            keys=keys,
            title=title,
            content=content,
            assistant_excerpt=json.dumps(slots, ensure_ascii=False),
            extra_note=f"no API key; local filler; accepted {len(accepted)}/{len(keys)} @>={threshold:.2f}",
            llm_request=llm_preview if show_complete_request_to_llm and llm_preview else None,
        )
        return slots, confidences, accepted, extra_slots, extra_confidences, accepted_extra, trace

    schema_hint = ", ".join(f'"{k}": {{"value": string, "confidence": number(0..1)}}' for k in keys)
    prompt = (
        "You are a structured field completion engine.\n"
        f"Task: fill only these keys for type={type_hint}: {keys}\n"
        "Rules:\n"
        "1) Return ONE JSON object only, no markdown, no prose.\n"
        "2) Use EXACTLY the listed keys; do NOT add or rename any key.\n"
        '3) Each key value must be object: {"value": string, "confidence": number between 0 and 1}.\n'
        "4) Keep values concise, plain text, and in the same language as title when possible.\n"
        "5) If uncertain, keep value empty string and set low confidence (<=0.4).\n"
        "6) Never output random identifiers, mixed-language garbage keys, or nested unrelated objects.\n\n"
        f"Title: {title}\n\nBody (may be empty):\n{content}\n\n"
        f"JSON schema shape: {{{schema_hint}}}"
    )
    if allow_custom_facets:
        prompt += (
            "\n\nAdditionally, include optional top-level key `extra_slots` as an object.\n"
            "extra_slots can contain NEW snake_case facet keys not in the required key list.\n"
            'Each extra key must map to {"value": string, "confidence": number between 0 and 1}.\n'
            "Do not duplicate required keys inside extra_slots."
        )
    llm_preview = _llm_request_preview(base_url=b_url, model=mdl, prompt=prompt)

    try:
        with httpx.Client(timeout=120.0) as client:
            r = client.post(
                f"{b_url}/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={
                    "model": mdl,
                    "messages": [{"role": "user", "content": prompt}],
                    "response_format": {"type": "json_object"},
                },
            )
            r.raise_for_status()
            data = r.json()
            raw = data["choices"][0]["message"]["content"]
            parsed = json.loads(raw)
            if not isinstance(parsed, dict):
                slots = _heuristic_slots(type_hint, title, content)
                confidences = _heuristic_confidences(keys)
                accepted = {k: v for k, v in slots.items() if confidences.get(k, 0.0) >= threshold}
                extra_slots = {}
                extra_confidences = {}
                accepted_extra = {}
                trace = _trace_slot_fill(
                    kind="fallback",
                    model=mdl,
                    type_hint=type_hint,
                    keys=keys,
                    title=title,
                    content=content,
                    assistant_excerpt=raw,
                    extra_note=f"model JSON was not an object; heuristic used; accepted {len(accepted)}/{len(keys)} @>={threshold:.2f}",
                    llm_request=llm_preview if show_complete_request_to_llm and llm_preview else None,
                )
                return slots, confidences, accepted, extra_slots, extra_confidences, accepted_extra, trace
            slots_payload = parsed.get("slots") if isinstance(parsed.get("slots"), dict) else parsed
            out: dict[str, str] = {}
            confidences: dict[str, float] = {}
            for k in keys:
                v = slots_payload.get(k, "") if isinstance(slots_payload, dict) else ""
                if isinstance(v, dict):
                    out[k] = _normalize_slot_value(v.get("value", ""))
                    # Missing/empty value should not get optimistic confidence.
                    base_conf = 0.65 if out[k] else 0.0
                    confidences[k] = _clamp_conf(v.get("confidence"), default=base_conf)
                elif v is not None:
                    out[k] = _normalize_slot_value(v)
                    confidences[k] = 0.62 if out[k] else 0.0
                else:
                    out[k] = ""
                    confidences[k] = 0.0
            accepted = {
                k: v
                for k, v in out.items()
                if v.strip() and confidences.get(k, 0.0) >= threshold
            }
            extra_slots: dict[str, str] = {}
            extra_confidences: dict[str, float] = {}
            accepted_extra: dict[str, str] = {}
            extra_raw = parsed.get("extra_slots") if isinstance(parsed.get("extra_slots"), dict) else {}
            for k, v in extra_raw.items():
                if not isinstance(k, str):
                    continue
                kk = k.strip()
                if (
                    not kk
                    or kk in keys
                    or len(kk) > 64
                    or re.match(r"^[a-z][a-z0-9_]*$", kk) is None
                ):
                    continue
                if isinstance(v, dict):
                    val = _normalize_slot_value(v.get("value", ""))
                    conf = _clamp_conf(v.get("confidence"), default=0.58 if val else 0.0)
                else:
                    val = _normalize_slot_value(v)
                    conf = 0.58 if val else 0.0
                extra_slots[kk] = val
                extra_confidences[kk] = conf
            accepted_extra = {k: v for k, v in extra_slots.items() if v.strip() and extra_confidences.get(k, 0.0) >= threshold}
            trace = _trace_slot_fill(
                kind="openai",
                model=mdl,
                type_hint=type_hint,
                keys=keys,
                title=title,
                content=content,
                assistant_excerpt=raw,
                extra_note=f"accepted {len(accepted)}/{len(keys)} + extra {len(accepted_extra)} @>={threshold:.2f}",
                llm_request=llm_preview if show_complete_request_to_llm and llm_preview else None,
            )
            return out, confidences, accepted, extra_slots, extra_confidences, accepted_extra, trace
    except Exception as e:
        slots = _heuristic_slots(type_hint, title, content)
        confidences = _heuristic_confidences(keys)
        accepted = {k: v for k, v in slots.items() if confidences.get(k, 0.0) >= threshold}
        extra_slots = {}
        extra_confidences = {}
        accepted_extra = {}
        trace = _trace_slot_fill(
            kind="fallback",
            model=mdl,
            type_hint=type_hint,
            keys=keys,
            title=title,
            content=content,
            assistant_excerpt=json.dumps(slots, ensure_ascii=False),
            extra_note=f"{str(e)[:180]}; accepted {len(accepted)}/{len(keys)} @>={threshold:.2f}",
            llm_request=llm_preview if show_complete_request_to_llm and llm_preview else None,
        )
        return slots, confidences, accepted, extra_slots, extra_confidences, accepted_extra, trace


def morph_collection_to_element(
    *,
    member_text: str,
    target_type: str,
    suggested_title: str,
    api_key: str | None,
    base_url: str | None,
    model: str | None,
    show_complete_request_to_llm: bool = False,
) -> tuple[str, str, dict[str, Any], dict[str, Any]]:
    """Returns (title, content, metadata dict with slots, ai_trace)."""
    keys = SLOT_KEYS_BY_TYPE.get(target_type, SLOT_KEYS_BY_TYPE["Idea"])
    key = (api_key or "").strip() or (settings.openai_api_key or "").strip()
    b_url = (base_url or "").strip().rstrip("/") or settings.openai_base_url.rstrip("/")
    mdl = (model or "").strip() or settings.openai_default_model

    if not key:
        slots = _heuristic_slots(target_type, suggested_title, member_text)
        md: dict[str, Any] = {"slots": slots, "morph_from_bundle": True}
        trace = _trace_morph(
            kind="heuristic",
            model=None,
            target_type=target_type,
            suggested_title=suggested_title,
            member_text=member_text,
            assistant_excerpt=json.dumps(slots, ensure_ascii=False),
            extra_note="no API key; local synthesis",
            llm_request=llm_preview if show_complete_request_to_llm and llm_preview else None,
        )
        return suggested_title, member_text[:8000], md, trace

    schema_hint = ", ".join(f'"{k}": string' for k in keys)
    prompt = (
        f"You synthesize one {target_type} element from a collection of source materials.\n"
        f"Return JSON with keys: title (string), content (string, long-form body), slots (object).\n"
        f"slots must have keys: {keys}. Values: {schema_hint}\n\n"
        f"Suggested title: {suggested_title}\n\nSource bundle:\n{member_text[:12000]}"
    )
    llm_preview = _llm_request_preview(base_url=b_url, model=mdl, prompt=prompt)

    try:
        with httpx.Client(timeout=120.0) as client:
            r = client.post(
                f"{b_url}/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={
                    "model": mdl,
                    "messages": [{"role": "user", "content": prompt}],
                    "response_format": {"type": "json_object"},
                },
            )
            r.raise_for_status()
            data = r.json()
            raw = data["choices"][0]["message"]["content"]
            parsed = json.loads(raw)
            title = str(parsed.get("title", suggested_title)).strip() or suggested_title
            body = str(parsed.get("content", "")).strip()
            slots_raw = parsed.get("slots") if isinstance(parsed.get("slots"), dict) else {}
            slots: dict[str, str] = {}
            for k in keys:
                v = slots_raw.get(k, "")
                slots[k] = str(v).strip() if v is not None else ""
            meta: dict[str, Any] = {"slots": slots, "morph_from_bundle": True}
            trace = _trace_morph(
                kind="openai",
                model=mdl,
                target_type=target_type,
                suggested_title=suggested_title,
                member_text=member_text,
                assistant_excerpt=raw,
                llm_request=llm_preview if show_complete_request_to_llm and llm_preview else None,
            )
            return title, body, meta, trace
    except Exception as e:
        slots = _heuristic_slots(target_type, suggested_title, member_text)
        meta = {"slots": slots, "morph_from_bundle": True}
        trace = _trace_morph(
            kind="fallback",
            model=mdl,
            target_type=target_type,
            suggested_title=suggested_title,
            member_text=member_text,
            assistant_excerpt=json.dumps(slots, ensure_ascii=False),
            extra_note=str(e)[:240],
            llm_request=llm_preview if show_complete_request_to_llm and llm_preview else None,
        )
        return suggested_title, member_text[:8000], meta, trace
