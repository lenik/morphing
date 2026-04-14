from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from morphing.api.deps import db_session
from morphing.services import element_service, visual_service

router = APIRouter(prefix="/visual", tags=["visual"])


@router.post("/prompts/shot/{shot_id}")
def shot_prompt(shot_id: str, db: Session = Depends(db_session)) -> dict:
    if not element_service.get_element(db, shot_id):
        raise HTTPException(status_code=404, detail="Shot not found")
    return visual_service.shot_to_prompt(db, shot_id)


@router.post("/prompts/storyboard/{storyboard_id}/batch")
def batch_storyboard(storyboard_id: str, db: Session = Depends(db_session)) -> dict:
    if not element_service.get_element(db, storyboard_id):
        raise HTTPException(status_code=404, detail="Storyboard not found")
    prompts = visual_service.batch_prompts(db, storyboard_id)
    return {"storyboard_id": storyboard_id, "prompts": prompts}
