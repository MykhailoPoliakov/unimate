import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Language = Literal["nl", "de", "fr", "en", "uk", "ru"]


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
    body: str


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
    body: str


class NewsOut(BaseModel):
    id: int
    is_published: bool
    translations: list[NewsTranslationOut]


class NewsVoteIn(BaseModel):
    option_index: int = Field(ge=0)


class NewsPollOut(BaseModel):
    options: list[str]
    counts: list[int]
    total: int
    your_vote: int | None


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