"""
algorithms.py

Implementatino of Data Structure and Graph.
 Python's heapq (used to back a
custom priority queue) and collections.deque (used to back a
custom queue) are used as low level building blocks  used as external.
"""

import heapq
import itertools
from collections import deque
from typing import Dict, List, Optional, Tuple


# MANUAL DATA STRUCTURES
class SimplePriorityQueue:
    #Priority Queue Backed up By HeapQ

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
    def __init__(self) -> None:
        self._items: List[object] = []

    def push(self, item: object) -> None:
        self._items.append(item)

    def pop(self) -> object:
        return self._items.pop()

    def is_empty(self) -> bool:
        return len(self._items) == 0


Adjacency = Dict[str, List[Tuple[str, float]]]


# PATH RECONSTRUCTION
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


# DIJKSTRA
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



# BFS
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


# DFS
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
