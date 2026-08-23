"""
routing.py
----------
Builds and stores per-router routing tables using Dijkstra's algorithm,
and recomputes them whenever the topology changes (router/link added,
removed, moved, or failed).
"""

from typing import Dict, Optional

from .graph import Graph
from .models import RouteEntry
from .algorithms import dijkstra, reconstruct_path


class RoutingManager:
    """Owns the 'routing protocol' logic: rebuilding every router's table."""

    def __init__(self, graph: Graph) -> None:
        self.graph = graph

    def recompute_all(self) -> None:
        """Recomputes the routing table for every router in the graph."""
        adjacency = self.graph.get_adjacency()

        for source_id, router in self.graph.routers.items():
            dist, prev, _ = dijkstra(adjacency, source_id)
            table: Dict[str, RouteEntry] = {}

            for dest_id in self.graph.routers:
                if dest_id == source_id:
                    continue
                if dist.get(dest_id, float("inf")) == float("inf"):
                    continue  # unreachable, no entry

                path = reconstruct_path(prev, source_id, dest_id) or []
                next_hop: Optional[str] = path[1] if len(path) > 1 else None
                table[dest_id] = RouteEntry(
                    destination=dest_id,
                    next_hop=next_hop,
                    cost=round(dist[dest_id], 2),
                    path=path,
                )

            router.routing_table = table

    def shortest_path(self, source_id: str, dest_id: str):
        """Returns (path, cost, visited_order) between two routers, or (None, None, visited_order)."""
        adjacency = self.graph.get_adjacency()
        dist, prev, visited_order = dijkstra(adjacency, source_id)
        if dist.get(dest_id, float("inf")) == float("inf"):
            return None, None, visited_order
        path = reconstruct_path(prev, source_id, dest_id)
        return path, round(dist[dest_id], 2), visited_order