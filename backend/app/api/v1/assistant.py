"""
NEXUS - Pluggable AI Assistant API Endpoints
Phase 11 Natural Language Decision Intelligence & Query Engine
Smart India Hackathon 2026 (SIH26202)
"""

from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import User
from app.api.deps import require_viewer
from app.services.assistant_service import (
    process_assistant_query,
    get_suggested_prompts,
)

router = APIRouter()


class ChatQueryRequest(BaseModel):
    prompt: str = Field(..., min_length=2, max_length=1000)


@router.get(
    "/assistant/suggested-prompts",
    response_model=List[str],
    summary="Get Curated Decision Queries and Prompt Starters",
)
def get_prompts(
    current_user: User = Depends(require_viewer),
):
    """Returns curated institutional questions for instant one-click querying."""
    return get_suggested_prompts()


@router.post(
    "/assistant/chat",
    summary="Execute Natural Language Decision Query",
)
def chat_with_assistant(
    payload: ChatQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    """
    Interprets natural language queries regarding energy conservation, space utilization,
    and counterfactual policies using database-backed analytical grounding.
    """
    return process_assistant_query(
        db=db,
        org_id=current_user.organization_id,
        prompt=payload.prompt,
    )
