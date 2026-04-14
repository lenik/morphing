"""Narrative graph: directed edges (parent -> child) stored as ElementRelation."""

RELATION_TYPES_DEFAULT = frozenset(
    {
        "linked",
        "contains",
        "derived",
        "character_in_story",
        "scene_in_story",
        "story_to_script",
        "script_to_storyboard",
        "storyboard_to_shot",
    }
)
