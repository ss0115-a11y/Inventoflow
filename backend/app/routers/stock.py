from typing import Union
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import User, UserRole
from app.core.dependencies import get_current_user
from app.schemas.stock import StockAdjustRequest, StockMovementResponse
from app.schemas.product import ProductAdminResponse, ProductStaffResponse
from app.services.product_service import adjust_stock, get_product_movements

router = APIRouter(prefix="/products", tags=["stock"])


@router.post("/{id}/stock", response_model=Union[ProductAdminResponse, ProductStaffResponse])
def update_product_stock(
    id: int,
    stock_in: StockAdjustRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = adjust_stock(db, id, stock_in, current_user)
    if current_user.role == UserRole.admin:
        return ProductAdminResponse.model_validate(product)
    return ProductStaffResponse.model_validate(product)


@router.get("/{id}/movements", response_model=list[StockMovementResponse])
def list_product_stock_movements(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_product_movements(db, id)
