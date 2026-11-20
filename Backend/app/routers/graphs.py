import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import SavedGraph, User
from app.schemas import GraphIn, GraphOut
from app.security import get_current_user

router = APIRouter(prefix="/api/graphs", tags=["graphs"])

MAX_GRAPH_BYTES = 100_000
MAX_GRAPHS_PER_USER = 200


def _validate(data: dict) -> None:
    if len(json.dumps(data)) > MAX_GRAPH_BYTES:
        raise HTTPException(413, "Graf je příliš velký")
    if not isinstance(data.get("nodes"), list) or not isinstance(data.get("edges", []), list):
        raise HTTPException(422, "Graf musí obsahovat seznam uzlů a hran")


def _own(graph_id: int, user: User, db: Session) -> SavedGraph:
    g = db.get(SavedGraph, graph_id)
    if not g or g.user_id != user.id:
        raise HTTPException(404, "Graf neexistuje")
    return g


@router.get("", response_model=list[GraphOut])
def list_graphs(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return list(db.scalars(select(SavedGraph).where(SavedGraph.user_id == user.id).order_by(SavedGraph.updated_at.desc())))


@router.post("", response_model=GraphOut, status_code=201)
def create_graph(body: GraphIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _validate(body.data)
    count = len(db.scalars(select(SavedGraph.id).where(SavedGraph.user_id == user.id)).all())
    if count >= MAX_GRAPHS_PER_USER:
        raise HTTPException(400, "Dosažen limit uložených grafů")
    g = SavedGraph(user_id=user.id, name=body.name, data=body.data)
    db.add(g)
    db.commit()
    db.refresh(g)
    return g


@router.put("/{graph_id}", response_model=GraphOut)
def update_graph(graph_id: int, body: GraphIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _validate(body.data)
    g = _own(graph_id, user, db)
    g.name, g.data = body.name, body.data
    db.commit()
    db.refresh(g)
    return g


@router.delete("/{graph_id}", status_code=204)
def delete_graph(graph_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    db.delete(_own(graph_id, user, db))
    db.commit()
