import math
from datetime import datetime, date, time
from decimal import Decimal
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, func
from fastapi import HTTPException, status

from app.models.models import Sale, SaleItem, Product, StockMovement, User, UserRole, MovementType
from app.schemas.sale import SaleCreate


def create_sale(db: Session, sale_in: SaleCreate, user: User) -> Sale:
    if not sale_in.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sale must contain at least one line item",
        )

    # Aggregate requested quantity per product
    qty_by_prod: dict[int, int] = {}
    for item in sale_in.items:
        if item.quantity <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Item quantity must be greater than zero",
            )
        qty_by_prod[item.product_id] = qty_by_prod.get(item.product_id, 0) + item.quantity

    sorted_pids = sorted(qty_by_prod.keys())

    # Lock product rows in consistent order to prevent deadlocks
    stmt = (
        select(Product)
        .where(Product.id.in_(sorted_pids))
        .with_for_update()
    )
    products = {p.id: p for p in db.scalars(stmt).all()}

    # Check existence and active status
    for pid in sorted_pids:
        if pid not in products:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID {pid} not found",
            )
        if not products[pid].is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product '{products[pid].name}' (SKU: {products[pid].sku}) is inactive and cannot be sold",
            )

    # Validate stock availability
    for pid, req_qty in qty_by_prod.items():
        prod = products[pid]
        if prod.stock < req_qty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock for product '{prod.name}' (SKU: {prod.sku}). Available: {prod.stock}, requested: {req_qty}",
            )

    # Create the sale header
    sale = Sale(
        user_id=user.id,
        total_amount=Decimal("0.00"),
        total_cost=Decimal("0.00"),
    )
    db.add(sale)
    db.flush()

    total_amount = Decimal("0.00")
    total_cost = Decimal("0.00")

    # Create line items, snapshot unit_price/unit_cost, decrement stock, and log stock movements
    for item in sale_in.items:
        prod = products[item.product_id]
        unit_price = prod.price
        unit_cost = prod.cost
        line_total = (unit_price * item.quantity).quantize(Decimal("0.01"))
        line_cost = (unit_cost * item.quantity).quantize(Decimal("0.01"))

        total_amount += line_total
        total_cost += line_cost

        sale_item = SaleItem(
            sale_id=sale.id,
            product_id=prod.id,
            quantity=item.quantity,
            unit_price=unit_price,
            unit_cost=unit_cost,
            line_total=line_total,
        )
        db.add(sale_item)

        # Decrement stock on product
        prod.stock -= item.quantity

        # Write sale stock movement (signed: negative quantity)
        movement = StockMovement(
            product_id=prod.id,
            user_id=user.id,
            type=MovementType.sale,
            quantity=-item.quantity,
            reason=f"Sale #{sale.id}",
        )
        db.add(movement)

    sale.total_amount = total_amount
    sale.total_cost = total_cost

    db.commit()
    return get_sale_by_id(db, sale.id, user)


def get_sales(
    db: Session,
    user: User,
    from_date: datetime | date | None = None,
    to_date: datetime | date | None = None,
    page: int = 1,
    page_size: int = 20,
):
    query = select(Sale).options(
        joinedload(Sale.user),
        joinedload(Sale.items).joinedload(SaleItem.product),
    )

    # Role check: Staff see only their own sales
    if user.role != UserRole.admin:
        query = query.where(Sale.user_id == user.id)

    # Date filters
    if from_date:
        if isinstance(from_date, date) and not isinstance(from_date, datetime):
            from_dt = datetime.combine(from_date, time.min)
        else:
            from_dt = from_date
        query = query.where(Sale.created_at >= from_dt)

    if to_date:
        if isinstance(to_date, date) and not isinstance(to_date, datetime):
            to_dt = datetime.combine(to_date, time.max)
        else:
            to_dt = to_date
        query = query.where(Sale.created_at <= to_dt)

    # Total count
    count_query = select(func.count()).select_from(query.subquery())
    total = db.scalar(count_query) or 0

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(Sale.created_at.desc()).offset(offset).limit(page_size)
    sales = db.scalars(query).unique().all()
    pages = math.ceil(total / page_size) if total > 0 else 1

    return sales, total, page, page_size, pages


def get_sale_by_id(db: Session, sale_id: int, user: User) -> Sale:
    stmt = (
        select(Sale)
        .options(
            joinedload(Sale.user),
            joinedload(Sale.items).joinedload(SaleItem.product),
        )
        .where(Sale.id == sale_id)
    )
    sale = db.scalar(stmt)
    if not sale:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sale with ID {sale_id} not found",
        )

    # Staff access check
    if user.role != UserRole.admin and sale.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff cannot access sales made by other users",
        )

    return sale
