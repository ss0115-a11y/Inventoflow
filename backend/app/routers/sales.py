from datetime import date, datetime
from typing import Union
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import User, UserRole, Sale
from app.core.dependencies import get_current_user
from app.schemas.sale import (
    SaleCreate,
    SaleAdminResponse,
    SaleStaffResponse,
    SaleItemAdminResponse,
    SaleItemStaffResponse,
    PaginatedSalesAdmin,
    PaginatedSalesStaff,
)
from app.services.sale_service import create_sale, get_sales, get_sale_by_id

router = APIRouter(prefix="/sales", tags=["sales"])


def format_sale_response(sale: Sale, is_admin: bool) -> SaleAdminResponse | SaleStaffResponse:
    items = []
    for item in sale.items:
        item_data = {
            "id": item.id,
            "sale_id": item.sale_id,
            "product_id": item.product_id,
            "product_name": item.product.name if item.product else None,
            "product_sku": item.product.sku if item.product else None,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "line_total": item.line_total,
        }
        if is_admin:
            item_data["unit_cost"] = item.unit_cost
            items.append(SaleItemAdminResponse(**item_data))
        else:
            items.append(SaleItemStaffResponse(**item_data))

    sale_data = {
        "id": sale.id,
        "user_id": sale.user_id,
        "user_name": sale.user.name if sale.user else None,
        "total_amount": sale.total_amount,
        "created_at": sale.created_at,
        "items": items,
    }
    if is_admin:
        sale_data["total_cost"] = sale.total_cost
        return SaleAdminResponse(**sale_data)
    return SaleStaffResponse(**sale_data)


@router.post("", response_model=Union[SaleAdminResponse, SaleStaffResponse], status_code=status.HTTP_201_CREATED)
def record_sale(
    sale_in: SaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sale = create_sale(db, sale_in, current_user)
    return format_sale_response(sale, is_admin=(current_user.role == UserRole.admin))


@router.get("", response_model=Union[PaginatedSalesAdmin, PaginatedSalesStaff])
def list_sales(
    from_date: datetime | date | None = Query(None, description="Start date filter (YYYY-MM-DD or ISO timestamp)"),
    to_date: datetime | date | None = Query(None, description="End date filter (YYYY-MM-DD or ISO timestamp)"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sales, total, page, page_size, pages = get_sales(
        db=db,
        user=current_user,
        from_date=from_date,
        to_date=to_date,
        page=page,
        page_size=page_size,
    )

    is_admin = current_user.role == UserRole.admin
    formatted_items = [format_sale_response(s, is_admin) for s in sales]

    if is_admin:
        return PaginatedSalesAdmin(
            items=formatted_items,
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
        )

    return PaginatedSalesStaff(
        items=formatted_items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/{id}", response_model=Union[SaleAdminResponse, SaleStaffResponse])
def get_sale(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sale = get_sale_by_id(db, id, current_user)
    return format_sale_response(sale, is_admin=(current_user.role == UserRole.admin))
