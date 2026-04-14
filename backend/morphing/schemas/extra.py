from pydantic import BaseModel, Field


class StoryComposeRequest(BaseModel):
    title: str = ""
    character_ids: list[str] = Field(default_factory=list)
    scene_ids: list[str] = Field(default_factory=list)
    actions: list[dict] = Field(default_factory=list)
    story_text: str = ""
    openai_api_key: str | None = None
    openai_base_url: str | None = None
    model: str | None = None
    author: str = ""


class StoryComposeResponse(BaseModel):
    id: str
    story_id: str
    focus_element_id: str
    created_element_ids: list[str] = Field(default_factory=list)
    created_relation_count: int = 0


class StoryComposePreviewResponse(BaseModel):
    title: str
    estimated_elements_by_type: dict[str, int] = Field(default_factory=dict)
    estimated_relation_count: int = 0
    preview_names: dict[str, list[str]] = Field(default_factory=dict)
    timeline_nodes: list[dict] = Field(default_factory=list)


class AppSettingsPayload(BaseModel):
    apiBaseUrl: str = ""
    openaiApiBaseUrl: str = "https://api.openai.com/v1"
    openaiApiKey: str = ""
    openaiOrganizationId: str = ""
    openaiDefaultModel: str = "gpt-4o-mini"
    aiCompletionAcceptConfidence: float = 0.6
    showCompleteRequestMessageToLlm: bool = False
    requestTimeoutSec: int = 120
    useBrowserNotifications: bool = True
    defaultAuthorName: str = ""
    locale: str = "en"


class AppSettingsHealthCheckResponse(BaseModel):
    ok: bool = False
    provider_status: int | None = None
    model: str = ""
    message: str = ""


class ShotCreateRequest(BaseModel):
    title: str = ""
    body: str = ""
    order: int | None = None


class ExtractRequest(BaseModel):
    text: str | None = None


class MorphPreviewRequest(BaseModel):
    change_note: str = ""


class CreditRequest(BaseModel):
    user_id: str
    role: str = "contributor"
