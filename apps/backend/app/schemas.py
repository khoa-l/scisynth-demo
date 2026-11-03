from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
)

from app.dataset_graph import (
    MAX_EDGES,
    MAX_NODES,
    DatasetGraph,
    GraphEdge,
    NodeSpec,
    ParamValue,
    Ref,
)

Email = Annotated[EmailStr, AfterValidator(str.lower)]


class RegisterRequest(BaseModel):
    email: Email
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: Email
    password: str


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str


class ProjectPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    created_at: datetime


Name = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)
]


class ProjectUpdate(BaseModel):
    name: Name


class ProjectCreate(BaseModel):
    name: Name


class DatasetPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    created_at: datetime
    content: DatasetGraph


class DatasetCreate(BaseModel):
    name: Name


class DatasetUpdate(BaseModel):
    name: Name | None = None
    content: DatasetGraph | None = None


class SurveyPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    created_at: datetime
    content: dict[str, Any]
    public_id: str | None
    published_version: int | None


class SurveyCreate(BaseModel):
    name: Name


class SurveyUpdate(BaseModel):
    name: Name | None = None
    content: dict[str, Any] | None = None


class SurveyVersionPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    number: int
    content: dict[str, Any]
    published_at: datetime


class SurveyResponsePublic(BaseModel):
    id: str
    version: int
    submitted_at: datetime
    data: dict[str, Any]


class PublishedSurvey(BaseModel):
    name: str
    version_id: str
    content: dict[str, Any]


class SurveyResponseCreate(BaseModel):
    version_id: str
    data: dict[str, Any]


class SurveyResponseReceipt(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    submitted_at: datetime


class StagePreviewRequest(BaseModel):
    kind: Ref
    params: dict[Ref, ParamValue] = Field(default_factory=dict, max_length=50)


class PlotFigure(BaseModel):
    data: list[dict[str, Any]]
    layout: dict[str, Any]


class NodePreviewRequest(BaseModel):
    node: Ref
    nodes: list[NodeSpec] = Field(max_length=MAX_NODES)
    edges: list[GraphEdge] = Field(default_factory=list, max_length=MAX_EDGES)


class TypedArray(BaseModel):
    dtype: Literal["f4"]
    bdata: str
    shape: str


class NodePreview(BaseModel):
    layout: Literal["grid", "points"]
    axes: list[str]
    x: TypedArray
    y: TypedArray
    channels: list[TypedArray]
