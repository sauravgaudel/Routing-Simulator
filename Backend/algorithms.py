"""
algorithms.py
-------------
Manual implementations of the core data structures and graph
algorithms used by the simulator. Nothing here comes from an
external graph library - only Python's heapq (used to back a
custom priority queue) and collections.deque (used to back a
custom queue) are used as low level building blocks.
"""

import heapq
import itertools
from collections import deque
from typing import Dict, List, Optional, Tuple


# ======================================================================
# MANUAL DATA STRUCTURES
# ======================================================================
class SimplePriorityQueue:
    """Min priority queue backed by heapq, wrapped so callers never
    touch heapq directly. Supports lazy deletion via a counter tiebreaker
    so equal-priority items never raise a comparison error."""

    def __init__(self) -> None:
        self._heap: List[Tuple[float, int, object]] = []
        self._counter = itertools.count()

    def push(self, priority: float, item: object) -> None:
        heapq.heappush(self._heap, (priority, next(self._counter), item))

    def pop(self) -> Tuple[float, object]:
        priority, _, item = heapq.heappop(self._heap)
        return priority, item

    def is_empty(self) -> bool:
        return len(self._heap) == 0


class SimpleQueue:
    """FIFO queue backed by collections.deque."""

    def __init__(self) -> None:
        self._items = deque()

    def enqueue(self, item: object) -> None:
        self._items.append(item)

    def dequeue(self) -> object:
        return self._items.popleft()

    def is_empty(self) -> bool:
        return len(self._items) == 0


class SimpleStack:
    """LIFO stack backed by a plain Python list."""

    def __init__(self) -> None:
        self._items: List[object] = []

    def push(self, item: object) -> None:
        self._items.append(item)

    def pop(self) -> object:
        return self._items.pop()

    def is_empty(self) -> bool:
        return len(self._items) == 0


Adjacency = Dict[str, List[Tuple[str, float]]]


# ======================================================================
# PATH RECONSTRUCTION
# ======================================================================
def reconstruct_path(prev: Dict[str, Optional[str]], source: str, target: str) -> Optional[List[str]]:
    if target != source and target not in prev:
        return None
    path = [target]
    while path[-1] != source:
        parent = prev.get(path[-1])
        if parent is None:
            return None
        path.append(parent)
    path.reverse()
    return path


# ======================================================================
# DIJKSTRA
# ======================================================================
def dijkstra(adjacency: Adjacency, source: str):
    """
    Returns:
        dist: Dict[node, float]           shortest distance from source
        prev: Dict[node, Optional[node]]  predecessor on the shortest path
        visited_order: List[node]         order nodes were finalized (for viz)
    """
    dist: Dict[str, float] = {node: float("inf") for node in adjacency}
    prev: Dict[str, Optional[str]] = {}
    visited: set = set()
    visited_order: List[str] = []

    dist[source] = 0.0
    pq = SimplePriorityQueue()
    pq.push(0.0, source)

    while not pq.is_empty():
        d, u = pq.pop()
        if u in visited:
            continue
        visited.add(u)
        visited_order.append(u)

        for neighbor, weight in adjacency.get(u, []):
            if neighbor in visited:
                continue
            new_dist = d + weight
            if new_dist < dist.get(neighbor, float("inf")):
                dist[neighbor] = new_dist
                prev[neighbor] = u
                pq.push(new_dist, neighbor)

    return dist, prev, visited_order


# ======================================================================
# BFS
# ======================================================================
def bfs(adjacency: Adjacency, source: str):
    """
    Returns:
        order: List[node]                 traversal order
        prev: Dict[node, Optional[node]]   predecessor for path reconstruction
    """
    visited = {source}
    prev: Dict[str, Optional[str]] = {}
    order: List[str] = []

    q = SimpleQueue()
    q.enqueue(source)

    while not q.is_empty():
        u = q.dequeue()
        order.append(u)
        for neighbor, _ in adjacency.get(u, []):
            if neighbor not in visited:
                visited.add(neighbor)
                prev[neighbor] = u
                q.enqueue(neighbor)

    return order, prev


# ======================================================================
# DFS
# ======================================================================
def dfs(adjacency: Adjacency, source: str):
    """
    Returns:
        order: List[node]                 traversal order
        prev: Dict[node, Optional[node]]   predecessor for path reconstruction
    """
    visited = set()
    prev: Dict[str, Optional[str]] = {}
    order: List[str] = []

    stack = SimpleStack()
    stack.push(source)

    while not stack.is_empty():
        u = stack.pop()
        if u in visited:
            continue
        visited.add(u)
        order.append(u)
        # push neighbors in reverse so left-to-right order feels natural
        neighbors = adjacency.get(u, [])
        for neighbor, _ in reversed(neighbors):
            if neighbor not in visited:
                if neighbor not in prev:
                    prev[neighbor] = u
                stack.push(neighbor)

    return order, prev


# ======================================================================
# BELLMAN-FORD
# ======================================================================
def bellman_ford(adjacency: Adjacency, source: str):
    """
    Returns:
        dist: Dict[node, float]
        prev: Dict[node, Optional[node]]
        has_negative_cycle: bool
        iterations: int              number of relaxation passes performed
    """
    nodes = list(adjacency.keys())
    dist: Dict[str, float] = {node: float("inf") for node in nodes}
    prev: Dict[str, Optional[str]] = {}
    dist[source] = 0.0

    # build a flat edge list (undirected -> both directions already present
    # in the adjacency list construction in graph.py)
    edges: List[Tuple[str, str, float]] = []
    for u, neighbors in adjacency.items():
        for v, w in neighbors:
            edges.append((u, v, w))

    iterations = 0
    for i in range(len(nodes) - 1 if nodes else 0):
        iterations += 1
        updated = False
        for u, v, w in edges:
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                prev[v] = u
                updated = True
        if not updated:
            break

    # one extra pass to detect negative cycles (won't trigger with
    # positive euclidean-based costs, but kept for correctness/education)
    has_negative_cycle = False
    for u, v, w in edges:
        if dist[u] + w < dist[v]:
            has_negative_cycle = True
            break

    return dist, prev, has_negative_cycle, iterations