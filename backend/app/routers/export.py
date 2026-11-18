from datetime import date, datetime, time
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import User
from app.core.dependencies import require_admin
from app.services.export_service import stream_products_csv, stream_sales_csv

router = APIRouter(prefix="/export", tags=["export"])


def parse_date_param(val: str | None) -> datetime | None:
    if not val:
        return None
    val = val.strip()
    try:
        return datetime.fromisoformat(val)
    except ValueError:
        pass
    try:
        d = date.fromisoformat(val)
        return datetime.combine(d, time.min)
    except ValueError:
        return None


@router.get("/products.csv")
def export_products_csv(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    headers = {
        "Content-Disposition": 'attachment; filename="products.csv"',
        "Content-Type": "text/csv; charset=utf-8",
    }
    return StreamingResponse(
        stream_products_csv(db),
        media_type="text/csv",
        headers=headers,
    )


@router.get("/sales.csv")
def export_sales_csv(
    from_date_raw: str | None = Query(None, alias="from", description="Start date (YYYY-MM-DD)"),
    to_date_raw: str | None = Query(None, alias="to", description="End date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    from_dt = parse_date_param(from_date_raw)
    to_dt = parse_date_param(to_date_raw)
    if to_dt and to_date_raw and len(to_date_raw.strip()) <= 10:
        # Extend to end of day if only date is passed
        to_dt = datetime.combine(to_dt.date(), time.max)

    headers = {
        "Content-Disposition": 'attachment; filename="sales.csv"',
        "Content-Type": "text/csv; charset=utf-8",
    }
    return StreamingResponse(
        stream_sales_csv(db, from_dt, to_dt),
        media_type="text/csv",
        headers=headers,
    )
