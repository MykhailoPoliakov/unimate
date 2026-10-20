import uuid
from datetime import datetime
from typing import Literal
import re
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field
from pydantic import field_validator

Language = Literal["nl", "de", "fr", "en", "uk", "ru"]


class NewsBlock(BaseModel):
    type: Literal["paragraph", "image", "button", "embed", "quote", "list"]
    content: str | None = None
    url: str | None = None
    label: str | None = None
    caption: str | None = None
    items: list[str] | None = None


class ProgramOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    slug: str
    name: str
    duration_years: int


class InstitutionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    slug: str
    name: str
    programs: list[ProgramOut] = []


class InstitutionCreate(BaseModel):
    slug: str = Field(min_length=2, max_length=50)
    name: str = Field(min_length=1, max_length=200)

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, value: str) -> str:
        slug = value.strip().lower()
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
            raise ValueError("Slug must use lowercase letters, numbers, and hyphens")
        return slug

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        name = value.strip()
        if not name:
            raise ValueError("Name cannot be empty")
        return name


class ProgramCreate(BaseModel):
    slug: str = Field(min_length=2, max_length=50)
    name: str = Field(min_length=1, max_length=200)
    duration_years: int = Field(ge=1)

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, value: str) -> str:
        slug = value.strip().lower()
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
            raise ValueError("Slug must use lowercase letters, numbers, and hyphens")
        return slug

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        name = value.strip()
        if not name:
            raise ValueError("Name cannot be empty")
        return name


class HomeButtonIn(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=500)
    url: str = Field(min_length=8, max_length=500)
    color: str | None = Field(default=None, max_length=32)
    platform: Literal["custom", "canvas", "student-service", "website", "schedule"] = "custom"

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        title = value.strip()
        if not title:
            raise ValueError("Name cannot be empty")
        return title

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str) -> str:
        url = value.strip()
        parsed = urlsplit(url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc or not parsed.hostname:
            raise ValueError("URL must be an absolute HTTP or HTTPS link")
        if parsed.username or parsed.password:
            raise ValueError("URL cannot contain credentials")
        return url

    @field_validator("color")
    @classmethod
    def validate_color(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        color = value.strip()
        if re.fullmatch(r"#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?", color):
            return color
        parts = color.split(",")
        if len(parts) == 3:
            try:
                channels = [int(part.strip()) for part in parts]
            except ValueError:
                channels = []
            if len(channels) == 3 and all(0 <= channel <= 255 for channel in channels):
                return ", ".join(str(channel) for channel in channels)
        raise ValueError("Color must be a hex color or three RGB values")


class HomeButtonsUpdate(BaseModel):
    buttons: list[HomeButtonIn] = Field(max_length=30)

    @field_validator("buttons")
    @classmethod
    def validate_buttons(cls, buttons: list[HomeButtonIn]) -> list[HomeButtonIn]:
        ids = [button.id for button in buttons]
        if len(ids) != len(set(ids)):
            raise ValueError("Button IDs must be unique")
        if sum(button.platform == "schedule" for button in buttons) > 1:
            raise ValueError("Only one Schedule button is allowed")
        return buttons


class HomeButtonsOut(BaseModel):
    configured: bool
    buttons: list[HomeButtonIn] = Field(default_factory=list)


class NameUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=200)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        name = value.strip()
        if not name:
            raise ValueError("Name cannot be empty")
        return name


class UserCreate(BaseModel):
    institution: str
    program: str
    year_of_study: int = Field(ge=1)
    language: Language = "en"


class UserUpdate(BaseModel):
    institution: str | None = None
    program: str | None = None
    year_of_study: int | None = Field(default=None, ge=1)
    language: Language | None = None


class UserOut(BaseModel):
    id: uuid.UUID
    institution: str
    program: str
    year_of_study: int
    language: Language
    role: Literal["student", "moderator", "admin"]
    moderator_institutions: list[str] = Field(default_factory=list)
    moderator_programs: list[str] = Field(default_factory=list)
    moderator_years: list[int] = Field(default_factory=list)


class UserRoleUpdate(BaseModel):
    role: Literal["student", "moderator", "admin"]
    institutions: list[str] = Field(default_factory=list)
    programs: list[str] = Field(default_factory=list)
    years: list[int] = Field(default_factory=list)


class PushDeviceUpdate(BaseModel):
    token: str = Field(min_length=20, max_length=255)
    enabled: bool = True


class NewsTranslationIn(BaseModel):
    lang: Language
    title: str
    excerpt: str | None = None
    body: str
    hero_image_url: str | None = None
    hero_image_alt: str | None = None
    cta_label: str | None = None
    cta_url: str | None = None
    tags: list[str] = Field(default_factory=list)
    blocks: list[NewsBlock] = Field(default_factory=list)


class NewsCreate(BaseModel):
    translations: list[NewsTranslationIn] = Field(min_length=1)
    is_published: bool = False
    institution: str | None = None
    program: str | None = None
    programs: list[str] = Field(default_factory=list)
    years: list[int] = Field(default_factory=list)
    year_min: int | None = Field(default=None, ge=1)
    year_max: int | None = Field(default=None, ge=1)


class NewsTranslationOut(BaseModel):
    lang: Language
    title: str
    excerpt: str | None = None
    body: str
    hero_image_url: str | None = None
    hero_image_alt: str | None = None
    cta_label: str | None = None
    cta_url: str | None = None
    tags: list[str] = Field(default_factory=list)
    blocks: list[NewsBlock] = Field(default_factory=list)


class NewsPollOut(BaseModel):
    options: list[str]
    counts: list[int]
    total: int
    your_vote: int | None


class NewsOut(BaseModel):
    id: int
    is_published: bool
    created_at: datetime | None = None
    author_id: str | None = None
    view_count: int | None = None
    institution: str | None = None
    program: str | None = None
    programs: list[str] = Field(default_factory=list)
    years: list[int] = Field(default_factory=list)
    translations: list[NewsTranslationOut]
    poll: NewsPollOut | None = None


class NewsViewOut(BaseModel):
    view_count: int | None = None


class NewsVoteIn(BaseModel):
    option_index: int = Field(ge=0)


class ButtonOut(BaseModel):
    id: int
    title: str
    description: str | None
    url: str
    icon: str | None
    color: str | None = None
    platform: str | None


class ButtonTranslationIn(BaseModel):
    lang: Language
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=500)


class ButtonCreate(BaseModel):
    url: str = Field(min_length=1, max_length=500)
    icon: str | None = Field(default=None, max_length=500)
    color: str | None = Field(default=None, max_length=32)
    platform: str | None = Field(default=None, max_length=30)
    sort_order: int = 0
    is_active: bool = True
    institution: str | None = None
    program: str | None = None
    programs: list[str] = Field(default_factory=list)
    years: list[int] = Field(default_factory=list)
    translations: list[ButtonTranslationIn] = Field(min_length=1)


class ButtonUpdate(BaseModel):
    url: str | None = Field(default=None, min_length=1, max_length=500)
    icon: str | None = Field(default=None, max_length=500)
    color: str | None = Field(default=None, max_length=32)
    platform: str | None = Field(default=None, max_length=30)
    sort_order: int | None = None
    is_active: bool | None = None
    institution: str | None = None
    program: str | None = None
    programs: list[str] | None = None
    years: list[int] | None = None
    translations: list[ButtonTranslationIn] | None = Field(default=None, min_length=1)


class ButtonTranslationAdminOut(ButtonTranslationIn):
    pass


class ButtonAdminOut(BaseModel):
    id: int
    url: str
    icon: str | None
    color: str | None
    platform: str | None
    sort_order: int
    is_active: bool
    institution: str | None
    program: str | None
    programs: list[str] = Field(default_factory=list)
    years: list[int] = Field(default_factory=list)
    translations: list[ButtonTranslationAdminOut]


class ButtonPreviewIn(BaseModel):
    url: str = Field(min_length=8, max_length=500)


class ButtonPreviewOut(BaseModel):
    title: str | None = None
    icon: str | None = None


class ButtonReorderIn(BaseModel):
    service_ids: list[int] = Field(default_factory=list)
    extra_ids: list[int] = Field(default_factory=list)


class SocialOut(BaseModel):
    id: int
    title: str
    description: str | None
    url: str
    icon: str | None
    platform: str | None


class SocialTranslationIn(BaseModel):
    lang: Language
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=500)


class SocialCreate(BaseModel):
    url: str = Field(min_length=1, max_length=500)
    icon: str | None = Field(default=None, max_length=100)
    platform: str | None = Field(default=None, max_length=30)
    sort_order: int = 0
    is_active: bool = True
    institution: str | None = None
    program: str | None = None
    programs: list[str] = Field(default_factory=list)
    years: list[int] = Field(default_factory=list)
    year_min: int | None = Field(default=None, ge=1)
    year_max: int | None = Field(default=None, ge=1)
    translations: list[SocialTranslationIn] = Field(min_length=1)


class SocialUpdate(BaseModel):
    url: str | None = Field(default=None, min_length=1, max_length=500)
    icon: str | None = Field(default=None, max_length=100)
    platform: str | None = Field(default=None, max_length=30)
    sort_order: int | None = None
    is_active: bool | None = None
    institution: str | None = None
    program: str | None = None
    programs: list[str] | None = None
    years: list[int] | None = None
    year_min: int | None = Field(default=None, ge=1)
    year_max: int | None = Field(default=None, ge=1)
    translations: list[SocialTranslationIn] | None = Field(default=None, min_length=1)


class SocialTranslationAdminOut(SocialTranslationIn):
    pass


class SocialAdminOut(BaseModel):
    id: int
    url: str
    icon: str | None
    platform: str | None
    sort_order: int
    is_active: bool
    institution: str | None
    program: str | None
    programs: list[str] = Field(default_factory=list)
    years: list[int] = Field(default_factory=list)
    year_min: int | None
    year_max: int | None
    translations: list[SocialTranslationAdminOut]