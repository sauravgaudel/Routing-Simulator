"""
simulation.py
-------------
Ties the Graph, RoutingManager and PacketBuilder together into a single
SimulationEngine: the object main.py talks to. It also owns the event
log and the running statistics shown in the UI's stats panel.
"""

from typing import Dict, List, Optional

from .graph import Graph
from .routing import RoutingManager
from .packet import PacketBuilder
from .models import LinkStatus, RouterStatus
from .utils import ascii_to_binary_steps, message_to_binary_stream, timestamp


class SimulationEngine:
    """Top level orchestrator. One instance lives for the app's lifetime."""

    def __init__(self) -> None:
        self.graph = Graph()
        self.routing = RoutingManager(self.graph)
        self.event_log: List[dict] = []
        self.stats = {
            "packets_sent": 0,
            "packets_delivered": 0,
            "packets_lost": 0,
            "transmissions": 0,
        }

    # EVENT LOG
    def log(self, event_type: str, message: str) -> None:
        self.event_log.append({
            "time": timestamp(),
            "type": event_type,
            "message": message,
        })
        # keep the log from growing unbounded
        if len(self.event_log) > 500:
            self.event_log = self.event_log[-500:]

    # TOPOLOGY MUTATIONS  (all trigger an automatic route recompute)
    def add_router(self, name: str, x: float, y: float):
        router = self.graph.add_router(name, x, y)
        self.log("Router Added", f"Router '{router.name}' ({router.id}) added at ({x:.0f}, {y:.0f}).")
        self._recompute()
        return router

    def remove_router(self, router_id: str) -> bool:
        router = self.graph.routers.get(router_id)
        ok = self.graph.remove_router(router_id)
        if ok:
            self.log("Router Removed", f"Router '{router.name if router else router_id}' removed.")
            self._recompute()
        return ok

    def move_router(self, router_id: str, x: float, y: float):
        router = self.graph.move_router(router_id, x, y)
        if router:
            self.log("Router Moved", f"Router '{router.name}' moved to ({x:.0f}, {y:.0f}). Costs updated.")
            self._recompute()
        return router

    def add_link(self, source: str, destination: str):
        link = self.graph.add_link(source, destination)
        if link:
            self.log("Link Added", f"Link {link.source} <-> {link.destination} created (cost {link.cost}).")
            self._recompute()
        return link

    def remove_link(self, source: str, destination: str) -> bool:
        ok = self.graph.remove_link(source, destination)
        if ok:
            self.log("Link Removed", f"Link {source} <-> {destination} removed.")
            self._recompute()
        return ok

    def fail_link(self, source: str, destination: str):
        link = self.graph.set_link_status(source, destination, LinkStatus.DOWN)
        if link:
            self.log("Failure Detected", f"Link {source} <-> {destination} has FAILED.")
            self._recompute()
        return link

    def restore_link(self, source: str, destination: str):
        link = self.graph.set_link_status(source, destination, LinkStatus.UP)
        if link:
            self.log("Link Restored", f"Link {source} <-> {destination} restored.")
            self._recompute()
        return link

    def _recompute(self) -> None:
        self.routing.recompute_all()
        self.log("Route Recomputed", "Routing tables rebuilt using Dijkstra's algorithm.")


    # TRANSMISSION
    def send_message(self, source: str, destination: str, message: str) -> dict:
        self.stats["transmissions"] += 1

        if source not in self.graph.routers or destination not in self.graph.routers:
            self.log("Transmission Failed", "Invalid source or destination router.")
            return {"success": False, "reason": "Invalid router id(s)."}

        path, cost, visited_order = self.routing.shortest_path(source, destination)

        ascii_steps = ascii_to_binary_steps(message)
        full_binary = message_to_binary_stream(message)

        if not path:
            self.stats["packets_lost"] += 1
            self.log("Transmission Failed", f"No path from {source} to {destination}.")
            return {
                "success": False,
                "reason": "No available path (network partitioned).",
                "ascii_steps": ascii_steps,
                "full_binary": full_binary,
                "visited_order": visited_order,
            }

        packets = PacketBuilder.build(message, source, destination)
        for p in packets:
            p.path = path

        self.stats["packets_sent"] += len(packets)
        self.stats["packets_delivered"] += len(packets)
        self.log(
            "Packet Created",
            f"{len(packets)} packet(s) created for message of {len(message)} characters."
        )
        self.log(
            "Packet Sent",
            f"Transmission from {source} to {destination} started via path {' -> '.join(path)}."
        )
        self.log("Transmission Completed", f"Message delivered to {destination}.")

        return {
            "success": True,
            "path": path,
            "cost": cost,
            "visited_order": visited_order,
            "ascii_steps": ascii_steps,
            "full_binary": full_binary,
            "packets": [p.to_dict() for p in packets],
            "reassembled_message": PacketBuilder.reassemble(packets),
        }

    # STATS
    def get_stats(self) -> dict:
        return {
            "routers": len(self.graph.routers),
            "links": len(self.graph.links),
            "average_link_cost": self.graph.average_link_cost(),
            "packets_sent": self.stats["packets_sent"],
            "packets_delivered": self.stats["packets_delivered"],
            "packets_lost": self.stats["packets_lost"],
            "transmissions": self.stats["transmissions"],
        }

engine=SimulationEngine()