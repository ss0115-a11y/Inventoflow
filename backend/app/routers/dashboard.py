from typing import Union
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import User
from app.core.dependencies import get_current_user
from app.schemas.dashboard import DashboardAdminSummary, DashboardStaffSummary
from app.services.dashboard_service import get_dashboard_summary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=Union[DashboardAdminSummary, DashboardStaffSummary])
def summary(
    days: int = Query(7, description="Number of days to analyze (default 7, commonly 7 or 30)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if days <= 0:
        days = 7
    return get_dashboard_summary(db=db, days=days, user=current_user)
