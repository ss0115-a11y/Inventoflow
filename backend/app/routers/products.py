from typing import Union
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import User, UserRole
from app.core.dependencies import get_current_user, require_admin
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductAdminResponse,
    ProductStaffResponse,
    PaginatedProductsAdmin,
    PaginatedProductsStaff,
)
from app.services.product_service import (
    get_products,
    get_product_by_id,
    create_product,
    update_product,
    soft_delete_product,
)

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=Union[PaginatedProductsAdmin, PaginatedProductsStaff])
def list_products(
    search: str | None = Query(None, description="Search by product name or SKU"),
    category_id: int | None = Query(None, description="Filter by category ID"),
    low_stock: bool | None = Query(None, description="Filter products at or below low stock threshold"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    include_inactive: bool = Query(False, description="Include soft-deleted products (admin only)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Only admins can view inactive products
    can_include_inactive = include_inactive and (current_user.role == UserRole.admin)

    items, total, page, page_size, pages = get_products(
        db=db,
        search=search,
        category_id=category_id,
        low_stock=low_stock,
        page=page,
        page_size=page_size,
        include_inactive=can_include_inactive,
    )

    if current_user.role == UserRole.admin:
        return PaginatedProductsAdmin(
            items=[ProductAdminResponse.model_validate(p) for p in items],
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
        )

    return PaginatedProductsStaff(
        items=[ProductStaffResponse.model_validate(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/{id}", response_model=Union[ProductAdminResponse, ProductStaffResponse])
def get_product(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = get_product_by_id(db, id)
    if current_user.role == UserRole.admin:
        return ProductAdminResponse.model_validate(product)
    return ProductStaffResponse.model_validate(product)


@router.post("", response_model=ProductAdminResponse, status_code=status.HTTP_201_CREATED)
def create_new_product(
    prod_in: ProductCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    product = create_product(db, prod_in, admin)
    return ProductAdminResponse.model_validate(product)


@router.put("/{id}", response_model=ProductAdminResponse)
def update_existing_product(
    id: int,
    prod_in: ProductUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    product = update_product(db, id, prod_in, admin)
    return ProductAdminResponse.model_validate(product)


@router.delete("/{id}")
def delete_product(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    soft_delete_product(db, id)
    return {"message": f"Product with ID {id} has been deactivated"}
