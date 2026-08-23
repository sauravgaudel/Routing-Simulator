


from fastapi import APIRouter,HTTPException
from ..main import engine
import validation

router=APIRouter()

@router.post("/link")
def create_link(payload: validation.LinkCreate):
    link = engine.add_link(payload.source, payload.destination)
    if not link:
        raise HTTPException(status_code=400, detail="Could not create link (check router ids).")
    return link.to_dict()


@router.delete("/link")
def delete_link(payload: validation.LinkDelete):
    ok = engine.remove_link(payload.source, payload.destination)
    if not ok:
        raise HTTPException(status_code=404, detail="Link not found.")
    return {"success": True}


@router.post("/link/fail")
def fail_link(payload: validation.LinkDelete):
    link = engine.fail_link(payload.source, payload.destination)
    if not link:
        raise HTTPException(status_code=404, detail="Link not found.")
    return link.to_dict()


@router.post("/link/restore")
def restore_link(payload: validation.LinkDelete):
    link = engine.restore_link(payload.source, payload.destination)
    if not link:
        raise HTTPException(status_code=404, detail="Link not found.")
    return link.to_dict()


@router.get("/links")
def list_links():
    return engine.graph.links_to_list()
