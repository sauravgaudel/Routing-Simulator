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
from API_routing import algorithmRun,linkAPI,routerAPI
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import validation
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


app.include_router(algorithmRun.router)
app.include_router(linkAPI.router)
app.include_router(routerAPI.router)

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
