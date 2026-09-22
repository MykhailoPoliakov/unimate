import uuid
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


class InstitutionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    slug: str
    name: str


class ProgramOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    slug: str
    name: str
    duration_years: int


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
    role: Literal["student", "admin"]


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


class NewsOut(BaseModel):
    id: int
    is_published: bool
    translations: list[NewsTranslationOut]


class ButtonOut(BaseModel):
    id: int
    title: str
    description: str | None
    url: str
    icon: str | None
    platform: str | None


class SocialOut(BaseModel):
    id: int
    title: str
    description: str | None
    url: str
    icon: str | None
    platform: str | None