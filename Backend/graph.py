"""
graph.py
--------
Manual implementation of the network graph using an adjacency list.

The Graph class is the single source of truth for topology: routers,
links, and the derived adjacency list used by every algorithm in
algorithms.py. No external graph library (e.g. networkx) is used.
"""

from typing import Dict, List, Optional, Tuple

from models import Router, Link, RouterStatus, LinkStatus
from utils import euclidean_distance, distance_to_cost, id_generator


class Graph:
    """Adjacency-list based undirected weighted graph of routers/links."""

    def __init__(self) -> None:
        self.routers: Dict[str, Router] = {}
        # links keyed by a stable, order-independent key: tuple(sorted([a, b]))
        self.links: Dict[Tuple[str, str], Link] = {}

    # ------------------------------------------------------------------
    # ROUTER OPERATIONS
    # ------------------------------------------------------------------
    def add_router(self, name: str, x: float, y: float) -> Router:
        router_id = id_generator.next("R")
        router = Router(id=router_id, name=name or router_id, x=x, y=y)
        self.routers[router_id] = router
        return router

    def remove_router(self, router_id: str) -> bool:
        if router_id not in self.routers:
            return False
        # remove every link touching this router
        for key in list(self.links.keys()):
            if router_id in key:
                del self.links[key]
        del self.routers[router_id]
        return True

    def move_router(self, router_id: str, x: float, y: float) -> Optional[Router]:
        router = self.routers.get(router_id)
        if not router:
            return None
        router.x = x
        router.y = y
        self._recompute_links_for(router_id)
        return router

    # ------------------------------------------------------------------
    # LINK OPERATIONS
    # ------------------------------------------------------------------
    @staticmethod
    def _link_key(a: str, b: str) -> Tuple[str, str]:
        return tuple(sorted([a, b]))  # type: ignore

    def add_link(self, source: str, destination: str) -> Optional[Link]:
        if source not in self.routers or destination not in self.routers:
            return None
        if source == destination:
            return None
        key = self._link_key(source, destination)
        if key in self.links:
            return self.links[key]

        distance, cost = self._calc_distance_cost(source, destination)
        link = Link(source=source, destination=destination, distance=distance, cost=cost)
        self.links[key] = link
        return link

    def remove_link(self, source: str, destination: str) -> bool:
        key = self._link_key(source, destination)
        if key in self.links:
            del self.links[key]
            return True
        return False

    def set_link_status(self, source: str, destination: str, status: LinkStatus) -> Optional[Link]:
        key = self._link_key(source, destination)
        link = self.links.get(key)
        if link:
            link.status = status
        return link

    def _calc_distance_cost(self, source: str, destination: str) -> Tuple[float, float]:
        r1 = self.routers[source]
        r2 = self.routers[destination]
        distance = euclidean_distance(r1.x, r1.y, r2.x, r2.y)
        cost = distance_to_cost(distance)
        return distance, cost

    def _recompute_links_for(self, router_id: str) -> None:
        """Recalculate distance/cost for every link touching this router."""
        for key, link in self.links.items():
            if router_id in key:
                distance, cost = self._calc_distance_cost(link.source, link.destination)
                link.distance = distance
                link.cost = cost

    # ------------------------------------------------------------------
    # ADJACENCY
    # ------------------------------------------------------------------
    def get_adjacency(self, ignore_down: bool = True) -> Dict[str, List[Tuple[str, float]]]:
        """
        Builds a fresh adjacency list: { router_id: [(neighbor_id, cost), ...] }
        Only UP links (and ACTIVE routers) are included when ignore_down=True.
        """
        adjacency: Dict[str, List[Tuple[str, float]]] = {rid: [] for rid in self.routers}
        for link in self.links.values():
            if ignore_down and link.status == LinkStatus.DOWN:
                continue
            if ignore_down:
                r1 = self.routers.get(link.source)
                r2 = self.routers.get(link.destination)
                if not r1 or not r2:
                    continue
                if r1.status == RouterStatus.DOWN or r2.status == RouterStatus.DOWN:
                    continue
            adjacency.setdefault(link.source, []).append((link.destination, link.cost))
            adjacency.setdefault(link.destination, []).append((link.source, link.cost))
        return adjacency

    # ------------------------------------------------------------------
    # SERIALIZATION
    # ------------------------------------------------------------------
    def routers_to_list(self) -> List[dict]:
        return [r.to_dict() for r in self.routers.values()]

    def links_to_list(self) -> List[dict]:
        return [l.to_dict() for l in self.links.values()]

    def average_link_cost(self) -> float:
        if not self.links:
            return 0.0
        return round(sum(l.cost for l in self.links.values()) / len(self.links), 2)