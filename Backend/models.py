
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional


class RouterStatus(str, Enum):
    ACTIVE = "active"
    DOWN = "down"


class LinkStatus(str, Enum):
    UP = "up"
    DOWN = "down"


class PacketStatus(str, Enum):
    CREATED = "created"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    LOST = "lost"


@dataclass
class RouteEntry:
    """One row of a router's routing table."""
    destination: str
    next_hop: Optional[str]
    cost: float
    path: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "destination": self.destination,
            "next_hop": self.next_hop,
            "cost": self.cost,
            "path": self.path,
        }


@dataclass #prevent from writing boiler plate
class Router:
    """A single node (router) in the network graph."""
    id: str
    name: str
    x: float
    y: float
    status: RouterStatus = RouterStatus.ACTIVE
    routing_table: Dict[str, RouteEntry] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "x": self.x,
            "y": self.y,
            "status": self.status.value,
            "routing_table": {
                dest: entry.to_dict() for dest, entry in self.routing_table.items()
            },
        }


@dataclass
class Link:
    """An undirected edge between two routers."""
    source: str
    destination: str
    distance: float
    cost: float
    status: LinkStatus = LinkStatus.UP

    @property
    def id(self) -> str:
        return f"{self.source}__{self.destination}"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "source": self.source,
            "destination": self.destination,
            "distance": round(self.distance, 2),
            "cost": self.cost,
            "status": self.status.value,
        }


@dataclass
class Packet:
    """A single packet produced when a message is split for transmission."""
    packet_id: str
    sequence: int
    total: int
    payload: str
    binary: str
    source: str
    destination: str
    path: List[str] = field(default_factory=list)
    status: PacketStatus = PacketStatus.CREATED

    def to_dict(self) -> dict:
        return {
            "packet_id": self.packet_id,
            "sequence": self.sequence,
            "total": self.total,
            "payload": self.payload,
            "binary": self.binary,
            "source": self.source,
            "destination": self.destination,
            "path": self.path,
            "status": self.status.value,
        }