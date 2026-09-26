import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

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


class UserRoleUpdate(BaseModel):
    role: Literal["student", "moderator", "admin"]


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
    translations: list[NewsTranslationOut]
    poll: NewsPollOut | None = None


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
    year_min: int | None
    year_max: int | None
    translations: list[SocialTranslationAdminOut]