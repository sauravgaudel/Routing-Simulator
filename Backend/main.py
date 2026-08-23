"""
main.py
-------
FastAPI application entry point. Exposes the full REST API consumed by
the vanilla-JS frontend. All state lives in a single in-memory
SimulationEngine instance - there is no database.

Run with:
    uvicorn main:app --reload --port 8000
"""

from typing import Optional, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from simulation import SimulationEngine
from algorithms import bfs, dfs, bellman_ford, reconstruct_path

app = FastAPI(title="Adaptive Network Routing Simulator", version="1.0.0")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = SimulationEngine()


<<<<<<< HEAD
=======

>>>>>>> 8ae26fc (Update main.py file)
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



@app.post("/router")
def create_router(payload: RouterCreate):
    router = engine.add_router(payload.name, payload.x, payload.y)
    return router.to_dict()


@app.delete("/router/{router_id}")
def delete_router(router_id: str):
    ok = engine.remove_router(router_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Router not found.")
    return {"success": True}


@app.post("/move_router")
def move_router(payload: RouterMove):
    router = engine.move_router(payload.id, payload.x, payload.y)
    if not router:
        raise HTTPException(status_code=404, detail="Router not found.")
    return router.to_dict()


@app.get("/routers")
def list_routers():
    return engine.graph.routers_to_list()


@app.post("/link")
def create_link(payload: LinkCreate):
    link = engine.add_link(payload.source, payload.destination)
    if not link:
        raise HTTPException(status_code=400, detail="Could not create link (check router ids).")
    return link.to_dict()


@app.delete("/link")
def delete_link(payload: LinkDelete):
    ok = engine.remove_link(payload.source, payload.destination)
    if not ok:
        raise HTTPException(status_code=404, detail="Link not found.")
    return {"success": True}


@app.post("/link/fail")
def fail_link(payload: LinkDelete):
    link = engine.fail_link(payload.source, payload.destination)
    if not link:
        raise HTTPException(status_code=404, detail="Link not found.")
    return link.to_dict()


@app.post("/link/restore")
def restore_link(payload: LinkDelete):
    link = engine.restore_link(payload.source, payload.destination)
    if not link:
        raise HTTPException(status_code=404, detail="Link not found.")
    return link.to_dict()


@app.get("/links")
def list_links():
    return engine.graph.links_to_list()


@app.post("/route")
def run_route(payload: RouteRequest):
    path, cost, visited_order = engine.routing.shortest_path(payload.source, payload.destination)
    return {
        "algorithm": "dijkstra",
        "path": path,
        "cost": cost,
        "visited_order": visited_order,
        "reachable": path is not None,
    }


@app.post("/bfs")
def run_bfs(payload: TraversalRequest):
    adjacency = engine.graph.get_adjacency()
    order, prev = bfs(adjacency, payload.source)
    return {"algorithm": "bfs", "order": order, "prev": prev}


@app.post("/dfs")
def run_dfs(payload: TraversalRequest):
    adjacency = engine.graph.get_adjacency()
    order, prev = dfs(adjacency, payload.source)
    return {"algorithm": "dfs", "order": order, "prev": prev}


@app.post("/bellman")
def run_bellman(payload: TraversalRequest):
    adjacency = engine.graph.get_adjacency()
    dist, prev, has_negative_cycle, iterations = bellman_ford(adjacency, payload.source)
    clean_dist = {k: (v if v != float("inf") else None) for k, v in dist.items()}
    return {
        "algorithm": "bellman-ford",
        "distances": clean_dist,
        "prev": prev,
        "has_negative_cycle": has_negative_cycle,
        "iterations": iterations,
    }


@app.post("/send")
def send_message(payload: SendRequest):
    return engine.send_message(payload.source, payload.destination, payload.message)



@app.get("/events")
def get_events(limit: int = 100):
    return engine.event_log[-limit:]


@app.get("/stats")
def get_stats():
    return engine.get_stats()


@app.get("/")
def root():
    return {
        "name": "Adaptive Network Routing Simulator API",
        "status": "running",
        "routers": len(engine.graph.routers),
        "links": len(engine.graph.links),
    }
