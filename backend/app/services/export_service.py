import csv
import io
from datetime import datetime, date, time
from typing import Iterator
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select

from app.models.models import Product, Sale, SaleItem


def stream_products_csv(db: Session) -> Iterator[str]:
    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "id", "sku", "name", "category", "price", "cost", "stock", "low_stock_threshold", "is_active", "created_at"
    ])
    yield output.getvalue()
    output.seek(0)
    output.truncate(0)

    stmt = select(Product).options(joinedload(Product.category)).order_by(Product.id.asc())
    for prod in db.scalars(stmt).unique():
        writer.writerow([
            prod.id,
            prod.sku,
            prod.name,
            prod.category.name if prod.category else "",
            str(prod.price),
            str(prod.cost),
            prod.stock,
            prod.low_stock_threshold,
            prod.is_active,
            prod.created_at.isoformat() if prod.created_at else "",
        ])
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)


def stream_sales_csv(
    db: Session,
    from_date: datetime | date | None = None,
    to_date: datetime | date | None = None,
) -> Iterator[str]:
    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "sale_id", "created_at", "user_name", "product_sku", "product_name",
        "quantity", "unit_price", "unit_cost", "line_total"
    ])
    yield output.getvalue()
    output.seek(0)
    output.truncate(0)

    query = (
        select(Sale)
        .options(
            joinedload(Sale.user),
            joinedload(Sale.items).joinedload(SaleItem.product),
        )
        .order_by(Sale.created_at.asc())
    )

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

    for sale in db.scalars(query).unique():
        user_name = sale.user.name if sale.user else "Unknown"
        created_str = sale.created_at.isoformat() if sale.created_at else ""
        for item in sale.items:
            sku = item.product.sku if item.product else ""
            name = item.product.name if item.product else ""
            writer.writerow([
                sale.id,
                created_str,
                user_name,
                sku,
                name,
                item.quantity,
                str(item.unit_price),
                str(item.unit_cost),
                str(item.line_total),
            ])
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)
