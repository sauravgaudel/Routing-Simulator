
from pydantic import BaseModel
from typing import Optional

class RouterCreate(BaseModel):
    name: Optional[str] = None
    x: float
    y: float


class RouterMove(BaseModel):
    id: str
    x: float
    y: float


class LinkCreate(BaseModel):
    source: str
    destination: str


class LinkDelete(BaseModel):
    source: str
    destination: str


class TraversalRequest(BaseModel):
    source: str


class RouteRequest(BaseModel):
    source: str
    destination: str


class SendRequest(BaseModel):
    source: str
    destination: str
    message: str