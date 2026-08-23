from ..simulation import engine
from .. import validation
from fastapi import APIRouter,HTTPException

router=APIRouter()
@router.post("/router")
def create_router(payload: validation.RouterCreate):
    router = engine.add_router(payload.name, payload.x, payload.y)
    return router.to_dict()


@router.delete("/router/{router_id}")
def delete_router(router_id: str):
    ok = engine.remove_router(router_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Router not found.")
    return {"success": True}


@router.post("/move_router")
def move_router(payload: validation.RouterMove):
    router = engine.move_router(payload.id, payload.x, payload.y)
    if not router:
        raise HTTPException(status_code=404, detail="Router not found.")
    return router.to_dict()

@router.get("/routers")
def list_routers():
    return engine.graph.routers_to_list()

@router.post("/send")
def send_message(payload: validation.SendRequest):
    return engine.send_message(payload.source, payload.destination, payload.message)

