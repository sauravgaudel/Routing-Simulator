from ..simulation import engine
from .. import validation
from fastapi import APIRouter,HTTPException
from ..algorithms import bfs, dfs, reconstruct_path

router=APIRouter()

@router.post("/route")
def run_route(payload: validation.RouteRequest):
    path, cost, visited_order = engine.routing.shortest_path(payload.source, payload.destination)
    return {
        "algorithm": "dijkstra",
        "path": path,
        "cost": cost,
        "visited_order": visited_order,
        "reachable": path is not None,
    }


@router.post("/bfs")
def run_bfs(payload: validation.TraversalRequest):
    adjacency = engine.graph.get_adjacency()
    order, prev = bfs(adjacency, payload.source)
    return {"algorithm": "bfs", "order": order, "prev": prev}


@router.post("/dfs")
def run_dfs(payload: validation.TraversalRequest):
    adjacency = engine.graph.get_adjacency()
    order, prev = dfs(adjacency, payload.source)
    return {"algorithm": "dfs", "order": order, "prev": prev}

