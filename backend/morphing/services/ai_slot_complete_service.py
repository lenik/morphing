"""Fill metadata.slots from title/body using OpenAI or heuristics."""

from __future__ import annotations

import json
import re
from typing import Any

import httpx

from morphing.config import settings

DEFAULT_CHAT_COMPLETIONS_OPTIONS: dict[str, Any] = {
    "temperature": 0.25,
    "top_p": 0.9,
    "reasoning_effort": "none",
}

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


def _char_script(ch: str) -> str:
    cp = ord(ch)
    if 0x4E00 <= cp <= 0x9FFF:
        return "cjk"
    if 0x3040 <= cp <= 0x30FF:
        return "jp"
    if 0xAC00 <= cp <= 0xD7AF:
        return "kr"
    if 0x0E00 <= cp <= 0x0E7F:
        return "thai"
    if 0x0400 <= cp <= 0x04FF:
        return "cyrillic"
    if ("A" <= ch <= "Z") or ("a" <= ch <= "z"):
        return "latin"
    return "other"


def _scripts_in_text(text: str) -> set[str]:
    out: set[str] = set()
    for ch in text or "":
        if ch.isalpha():
            out.add(_char_script(ch))
    return out


def _is_language_consistent(reference: str, value: str) -> bool:
    """
    Keep outputs readable in one language family.
    Allow latin alongside CJK/JP/KR (common for names/terms), but reject heavy multi-script noise.
    """
    val_scripts = _scripts_in_text(value)
    if not val_scripts:
        return True
    # Too many script families is usually model garbage.
    if len(val_scripts) >= 3:
        return False

    ref_scripts = _scripts_in_text(reference)
    if not ref_scripts:
        return True

    if "cjk" in ref_scripts or "jp" in ref_scripts or "kr" in ref_scripts:
        allowed = {"latin", "cjk", "jp", "kr", "other"}
        return val_scripts.issubset(allowed)
    if "latin" in ref_scripts:
        allowed = {"latin", "other"}
        return val_scripts.issubset(allowed)
    # Fallback: require overlap with reference scripts.
    return bool(val_scripts.intersection(ref_scripts))


def _allowed_scripts_for_locale(locale: str | None) -> set[str] | None:
    loc = (locale or "").strip().lower()
    if not loc:
        return None
    if loc.startswith("zh"):
        return {"cjk", "latin", "other"}
    if loc.startswith("ja"):
        return {"jp", "cjk", "latin", "other"}
    if loc.startswith("ko"):
        return {"kr", "latin", "other"}
    if loc.startswith("th"):
        return {"thai", "latin", "other"}
    if loc.startswith("ru"):
        return {"cyrillic", "latin", "other"}
    if loc.startswith("en"):
        return {"latin", "other"}
    return None


def _matches_forced_locale(value: str, locale: str | None) -> bool:
    allowed = _allowed_scripts_for_locale(locale)
    if not allowed:
        return True
    scripts = _scripts_in_text(value)
    if not scripts:
        return True
    return scripts.issubset(allowed)


def _extract_json_object_from_text(raw: str) -> dict[str, Any] | None:
    """
    Parse providers that may prepend reasoning text before JSON.
    Strategy:
    1) direct json.loads(raw)
    2) scan for balanced {...} blocks and parse from the end
    """
    txt = (raw or "").strip()
    if not txt:
        return None
    try:
        parsed = json.loads(txt)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        pass

    # Strip common think wrappers used by various models.
    cleaned = txt
    for pat in (
        r"<think>[\s\S]*?</think>",
        r"<thinking>[\s\S]*?</thinking>",
        r"\[think\][\s\S]*?\[/think\]",
        r"\[thinking\][\s\S]*?\[/thinking\]",
    ):
        cleaned = re.sub(pat, "", cleaned, flags=re.IGNORECASE)

    # Try fenced code block first.
    code_blocks = re.findall(r"```(?:json)?\s*([\s\S]*?)```", cleaned, flags=re.IGNORECASE)
    for block in reversed(code_blocks):
        b = block.strip()
        try:
            parsed = json.loads(b)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass

    candidates: list[str] = []
    start = -1
    depth = 0
    in_str = False
    esc = False
    for i, ch in enumerate(cleaned):
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
            continue
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
            continue
        if ch == "}":
            if depth > 0:
                depth -= 1
                if depth == 0 and start >= 0:
                    candidates.append(cleaned[start : i + 1])
                    start = -1
            continue

    for c in reversed(candidates):
        try:
            parsed = json.loads(c)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            continue
    # Last resort: widest brace slice.
    i0 = cleaned.find("{")
    i1 = cleaned.rfind("}")
    if i0 >= 0 and i1 > i0:
        tail = cleaned[i0 : i1 + 1]
        try:
            parsed = json.loads(tail)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass
    return None


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


def _llm_request_preview(*, base_url: str, model: str, prompt: str, stream: bool = False) -> str:
    body = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "response_format": {"type": "json_object"},
        **DEFAULT_CHAT_COMPLETIONS_OPTIONS,
    }
    if stream:
        body["stream"] = True
    return json.dumps(
        {
            "url": f"{base_url.rstrip('/')}/chat/completions",
            "headers": {
                "Authorization": "Bearer <OPENAI_API_KEY>",
                "Content-Type": "application/json",
            },
            "body": body,
        },
        ensure_ascii=False,
        indent=2,
    )


def build_complete_slots_prompt(
    *,
    type_hint: str,
    title: str,
    content: str,
    allow_custom_facets: bool = True,
    locale: str | None = None,
) -> tuple[list[str], str]:
    keys = SLOT_KEYS_BY_TYPE.get(type_hint, SLOT_KEYS_BY_TYPE["Idea"])
    schema_hint = ", ".join(f'"{k}": {{"value": string, "confidence": number(0..1)}}' for k in keys)
    prompt = (
        "You are a structured field completion engine.\n"
        f"Task: fill only these keys for type={type_hint}: {keys}\n"
        "Rules:\n"
        "1) Return ONE JSON object only, no markdown, no prose.\n"
        "2) Use listed keys; do NOT rename keys.\n"
        '3) Each key value must be object: {"value": string, "confidence": number between 0 and 1}.\n'
        "4) Keep values concise, plain text, and in the same language as title when possible.\n"
        "5) Do not return empty values. If uncertain, omit that key entirely.\n"
        "6) Never output random identifiers, mixed-language garbage keys, or nested unrelated objects.\n\n"
        "7) Also output top-level `title` (string) as an improved concise title for this element.\n"
        "8) If Body is empty or weak, output top-level `body` (string) with a useful draft body text.\n\n"
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
    if (locale or "").strip():
        prompt += (
            f"\n\nLanguage rule (strict): output all value strings in locale `{(locale or '').strip()}` only."
            "\nDo not guess another language."
            "\nIf unsure, return empty string with low confidence."
        )
    return keys, prompt


def resolve_ai_settings(api_key: str | None, base_url: str | None, model: str | None) -> tuple[str, str, str]:
    key = (api_key or "").strip() or (settings.openai_api_key or "").strip()
    b_url = (base_url or "").strip().rstrip("/") or settings.openai_base_url.rstrip("/")
    mdl = (model or "").strip() or settings.openai_default_model
    return key, b_url, mdl


def parse_complete_slots_raw(
    *,
    raw: str,
    title: str,
    type_hint: str,
    content: str,
    model: str | None,
    accept_confidence: float | None = None,
    allow_custom_facets: bool = True,
    show_complete_request_to_llm: bool = False,
    llm_request: str | None = None,
    locale: str | None = None,
) -> tuple[
    dict[str, str],
    dict[str, float],
    dict[str, str],
    dict[str, str],
    dict[str, float],
    dict[str, str],
    str | None,
    str | None,
    dict[str, Any],
]:
    keys = SLOT_KEYS_BY_TYPE.get(type_hint, SLOT_KEYS_BY_TYPE["Idea"])
    threshold = max(0.5, min(1.0, float(accept_confidence if accept_confidence is not None else 0.6)))
    parsed = _extract_json_object_from_text(raw)
    if not isinstance(parsed, dict):
        slots = _heuristic_slots(type_hint, title, content)
        confidences = _heuristic_confidences(keys)
        accepted = {k: v for k, v in slots.items() if confidences.get(k, 0.0) >= threshold}
        extra_slots = {}
        extra_confidences = {}
        accepted_extra = {}
        trace = _trace_slot_fill(
            kind="fallback",
            model=model,
            type_hint=type_hint,
            keys=keys,
            title=title,
            content=content,
            assistant_excerpt=raw,
            extra_note=f"model JSON was not an object; heuristic used; accepted {len(accepted)}/{len(keys)} @>={threshold:.2f}",
            llm_request=llm_request if show_complete_request_to_llm and llm_request else None,
        )
        return slots, confidences, accepted, extra_slots, extra_confidences, accepted_extra, None, None, trace

    slots_payload = parsed.get("slots") if isinstance(parsed.get("slots"), dict) else parsed
    # Be tolerant to wrapper shapes like {"character": {...}} or {"data": {"slots": {...}}}.
    if isinstance(slots_payload, dict):
        has_required_key = any(k in slots_payload for k in keys)
        if not has_required_key:
            nested_candidates: list[dict[str, Any]] = []
            for vv in slots_payload.values():
                if isinstance(vv, dict):
                    if isinstance(vv.get("slots"), dict):
                        nested_candidates.append(vv.get("slots"))
                    nested_candidates.append(vv)
            for cand in nested_candidates:
                if any(k in cand for k in keys):
                    slots_payload = cand
                    break
    out: dict[str, str] = {}
    confidences: dict[str, float] = {}
    for k in keys:
        v = slots_payload.get(k, "") if isinstance(slots_payload, dict) else ""
        if isinstance(v, dict):
            out[k] = _normalize_slot_value(v.get("value", ""))
            base_conf = 0.65 if out[k] else 0.0
            confidences[k] = _clamp_conf(v.get("confidence"), default=base_conf)
        elif v is not None:
            out[k] = _normalize_slot_value(v)
            confidences[k] = 0.62 if out[k] else 0.0
        else:
            out[k] = ""
            confidences[k] = 0.0
        if out[k]:
            if locale and not _matches_forced_locale(out[k], locale):
                out[k] = ""
                confidences[k] = 0.0
            elif not _is_language_consistent(f"{title}\n{content}\n{locale or ''}", out[k]):
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
    if allow_custom_facets:
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
            if val:
                if locale and not _matches_forced_locale(val, locale):
                    val = ""
                    conf = 0.0
                elif not _is_language_consistent(f"{title}\n{content}\n{locale or ''}", val):
                    val = ""
                    conf = 0.0
            extra_slots[kk] = val
            extra_confidences[kk] = conf
    accepted_extra = {k: v for k, v in extra_slots.items() if v.strip() and extra_confidences.get(k, 0.0) >= threshold}
    accepted_title: str | None = None
    title_raw = parsed.get("title") if isinstance(parsed, dict) else None
    if title_raw is not None:
        tval = _normalize_slot_value(title_raw)
        if tval and (not locale or _matches_forced_locale(tval, locale)):
            accepted_title = tval
    accepted_body: str | None = None
    body_raw = parsed.get("body", parsed.get("content")) if isinstance(parsed, dict) else None
    if body_raw is not None:
        bval = _normalize_slot_value(body_raw)
        if bval and (not locale or _matches_forced_locale(bval, locale)):
            accepted_body = bval
    trace = _trace_slot_fill(
        kind="openai",
        model=model,
        type_hint=type_hint,
        keys=keys,
        title=title,
        content=content,
        assistant_excerpt=raw,
        extra_note=f"accepted {len(accepted)}/{len(keys)} + extra {len(accepted_extra)} @>={threshold:.2f}",
        llm_request=llm_request if show_complete_request_to_llm and llm_request else None,
    )
    return out, confidences, accepted, extra_slots, extra_confidences, accepted_extra, accepted_title, accepted_body, trace


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
    locale: str | None = None,
) -> tuple[
    dict[str, str],
    dict[str, float],
    dict[str, str],
    dict[str, str],
    dict[str, float],
    dict[str, str],
    str | None,
    str | None,
    dict[str, Any],
]:
    keys = SLOT_KEYS_BY_TYPE.get(type_hint, SLOT_KEYS_BY_TYPE["Idea"])
    key, b_url, mdl = resolve_ai_settings(api_key, base_url, model)
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
        return slots, confidences, accepted, extra_slots, extra_confidences, accepted_extra, None, None, trace

    _, prompt = build_complete_slots_prompt(
        type_hint=type_hint,
        title=title,
        content=content,
        allow_custom_facets=allow_custom_facets,
        locale=locale,
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
                    **DEFAULT_CHAT_COMPLETIONS_OPTIONS,
                },
            )
            r.raise_for_status()
            data = r.json()
            raw = data["choices"][0]["message"]["content"]
            return parse_complete_slots_raw(
                raw=raw,
                title=title,
                type_hint=type_hint,
                content=content,
                model=mdl,
                accept_confidence=accept_confidence,
                allow_custom_facets=allow_custom_facets,
                show_complete_request_to_llm=show_complete_request_to_llm,
                llm_request=llm_preview,
                locale=locale,
            )
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
        return slots, confidences, accepted, extra_slots, extra_confidences, accepted_extra, None, None, trace


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
                    **DEFAULT_CHAT_COMPLETIONS_OPTIONS,
                },
            )
            r.raise_for_status()
            data = r.json()
            raw = data["choices"][0]["message"]["content"]
            parsed = _extract_json_object_from_text(raw)
            if not isinstance(parsed, dict):
                raise ValueError("model response does not contain parseable JSON object")
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
