import math
from decimal import Decimal
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, func, or_
from fastapi import HTTPException, status

from app.models.models import Product, Category, StockMovement, User, UserRole, MovementType
from app.schemas.product import ProductCreate, ProductUpdate
from app.schemas.stock import StockAdjustRequest


def get_products(
    db: Session,
    search: str | None = None,
    category_id: int | None = None,
    low_stock: bool | None = None,
    page: int = 1,
    page_size: int = 20,
    include_inactive: bool = False,
):
    query = select(Product).options(joinedload(Product.category))

    if not include_inactive:
        query = query.where(Product.is_active.is_(True))

    if search:
        search_term = f"%{search.strip()}%"
        query = query.where(
            or_(
                Product.name.ilike(search_term),
                Product.sku.ilike(search_term),
            )
        )

    if category_id is not None:
        query = query.where(Product.category_id == category_id)

    if low_stock is True:
        query = query.where(Product.stock <= Product.low_stock_threshold)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = db.scalar(count_query) or 0

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(Product.name.asc()).offset(offset).limit(page_size)
    items = list(db.scalars(query).all())
    pages = math.ceil(total / page_size) if total > 0 else 1

    return items, total, page, page_size, pages


def get_product_by_id(db: Session, product_id: int) -> Product:
    stmt = (
        select(Product)
        .options(joinedload(Product.category))
        .where(Product.id == product_id)
    )
    product = db.scalar(stmt)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found",
        )
    return product


def create_product(db: Session, data: ProductCreate, user: User) -> Product:
    # Check sku uniqueness
    existing_sku = db.scalar(select(Product).where(Product.sku == data.sku.strip()))
    if existing_sku:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Product with SKU '{data.sku}' already exists",
        )

    # Validate category if provided
    if data.category_id is not None:
        cat = db.get(Category, data.category_id)
        if not cat:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Category with ID {data.category_id} does not exist",
            )

    product = Product(
        sku=data.sku.strip(),
        name=data.name.strip(),
        category_id=data.category_id,
        price=data.price,
        cost=data.cost,
        stock=data.stock,
        low_stock_threshold=data.low_stock_threshold,
        is_active=True,
    )
    db.add(product)
    db.flush()

    if data.stock > 0:
        movement = StockMovement(
            product_id=product.id,
            user_id=user.id,
            type=MovementType.adjustment,
            quantity=data.stock,
            reason="Initial stock upon product creation",
        )
        db.add(movement)

    db.commit()
    db.refresh(product)
    return product


def update_product(db: Session, product_id: int, data: ProductUpdate, user: User) -> Product:
    product = get_product_by_id(db, product_id)

    if data.sku is not None and data.sku.strip() != product.sku:
        existing = db.scalar(select(Product).where(Product.sku == data.sku.strip()))
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product with SKU '{data.sku}' already exists",
            )
        product.sku = data.sku.strip()

    if data.category_id is not None:
        cat = db.get(Category, data.category_id)
        if not cat:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Category with ID {data.category_id} does not exist",
            )
        product.category_id = data.category_id

    if data.name is not None:
        product.name = data.name.strip()
    if data.price is not None:
        product.price = data.price
    if data.cost is not None:
        product.cost = data.cost
    if data.low_stock_threshold is not None:
        product.low_stock_threshold = data.low_stock_threshold
    if data.is_active is not None:
        product.is_active = data.is_active

    # If stock is explicitly modified via update
    if data.stock is not None and data.stock != product.stock:
        diff = data.stock - product.stock
        movement = StockMovement(
            product_id=product.id,
            user_id=user.id,
            type=MovementType.adjustment,
            quantity=diff,
            reason=f"Direct stock edit from {product.stock} to {data.stock}",
        )
        db.add(movement)
        product.stock = data.stock

    db.commit()
    db.refresh(product)
    return product


def soft_delete_product(db: Session, product_id: int) -> Product:
    product = get_product_by_id(db, product_id)
    product.is_active = False
    db.commit()
    db.refresh(product)
    return product


def adjust_stock(db: Session, product_id: int, request: StockAdjustRequest, user: User) -> Product:
    # Use with_for_update to lock product row
    stmt = select(Product).where(Product.id == product_id).with_for_update()
    product = db.scalar(stmt)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found",
        )

    # Permission and quantity checks
    if request.type == "purchase":
        if request.quantity <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Purchase quantity must be positive",
            )
        mov_type = MovementType.purchase
    elif request.type == "adjustment":
        if request.quantity == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Adjustment quantity cannot be zero",
            )
        if request.quantity < 0 and user.role != UserRole.admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin users can perform negative stock adjustments",
            )
        mov_type = MovementType.adjustment
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid movement type: {request.type}",
        )

    new_stock = product.stock + request.quantity
    if new_stock < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stock adjustment would result in negative stock ({new_stock}). Current: {product.stock}",
        )

    product.stock = new_stock

    movement = StockMovement(
        product_id=product.id,
        user_id=user.id,
        type=mov_type,
        quantity=request.quantity,
        reason=request.reason,
    )
    db.add(movement)
    db.commit()
    db.refresh(product)
    return product


def get_product_movements(db: Session, product_id: int) -> list[dict]:
    # Ensure product exists
    get_product_by_id(db, product_id)

    stmt = (
        select(StockMovement)
        .options(joinedload(StockMovement.user))
        .where(StockMovement.product_id == product_id)
        .order_by(StockMovement.created_at.desc())
    )
    movements = db.scalars(stmt).all()

    result = []
    for m in movements:
        result.append({
            "id": m.id,
            "product_id": m.product_id,
            "user_id": m.user_id,
            "user_name": m.user.name if m.user else None,
            "type": m.type,
            "quantity": m.quantity,
            "reason": m.reason,
            "created_at": m.created_at,
        })
    return result
