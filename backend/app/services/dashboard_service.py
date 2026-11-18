from datetime import datetime, date, time, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, func

from app.models.models import Sale, SaleItem, Product, User, UserRole
from app.schemas.dashboard import (
    DailyTrendItem,
    TopProductItem,
    DashboardStaffSummary,
    DashboardAdminSummary,
)
from app.schemas.product import ProductStaffResponse, ProductAdminResponse


def get_dashboard_summary(db: Session, days: int, user: User) -> DashboardStaffSummary | DashboardAdminSummary:
    now = datetime.now()
    today_start = datetime.combine(now.date(), time.min)
    start_7d = now - timedelta(days=7)
    start_30d = now - timedelta(days=30)
    period_start = now - timedelta(days=days)

    # 1. Revenue aggregations via SQL
    rev_today_stmt = select(func.coalesce(func.sum(Sale.total_amount), 0)).where(Sale.created_at >= today_start)
    revenue_today = Decimal(str(db.scalar(rev_today_stmt) or 0)).quantize(Decimal("0.01"))

    rev_7d_stmt = select(func.coalesce(func.sum(Sale.total_amount), 0)).where(Sale.created_at >= start_7d)
    revenue_7d = Decimal(str(db.scalar(rev_7d_stmt) or 0)).quantize(Decimal("0.01"))

    rev_30d_stmt = select(func.coalesce(func.sum(Sale.total_amount), 0)).where(Sale.created_at >= start_30d)
    revenue_30d = Decimal(str(db.scalar(rev_30d_stmt) or 0)).quantize(Decimal("0.01"))

    # 2. Daily trend aggregation (zero-filled across the requested days)
    start_date = (now - timedelta(days=days - 1)).date()
    end_date = now.date()

    date_col = func.date(Sale.created_at)
    trend_stmt = (
        select(
            date_col.label("sale_date"),
            func.coalesce(func.sum(Sale.total_amount), 0).label("revenue"),
            func.count(Sale.id).label("orders"),
        )
        .where(Sale.created_at >= datetime.combine(start_date, time.min))
        .group_by(date_col)
    )

    trend_rows = db.execute(trend_stmt).all()
    trend_map: dict[str, tuple[Decimal, int]] = {}
    for r in trend_rows:
        d_val = r.sale_date
        d_str = d_val.strftime("%Y-%m-%d") if isinstance(d_val, (date, datetime)) else str(d_val)
        trend_map[d_str] = (Decimal(str(r.revenue)).quantize(Decimal("0.01")), int(r.orders))

    daily_trend: list[DailyTrendItem] = []
    for i in range(days):
        current_d = start_date + timedelta(days=i)
        current_str = current_d.strftime("%Y-%m-%d")
        rev, ords = trend_map.get(current_str, (Decimal("0.00"), 0))
        daily_trend.append(DailyTrendItem(date=current_str, revenue=rev, orders=ords))

    # 3. Top products by quantity sold
    top_stmt = (
        select(
            Product.id.label("product_id"),
            Product.name.label("name"),
            Product.sku.label("sku"),
            func.coalesce(func.sum(SaleItem.quantity), 0).label("quantity"),
            func.coalesce(func.sum(SaleItem.line_total), 0).label("revenue"),
        )
        .join(SaleItem, SaleItem.product_id == Product.id)
        .group_by(Product.id, Product.name, Product.sku)
        .order_by(func.sum(SaleItem.quantity).desc())
        .limit(5)
    )
    top_rows = db.execute(top_stmt).all()
    top_products = [
        TopProductItem(
            product_id=r.product_id,
            name=r.name,
            sku=r.sku,
            quantity_sold=int(r.quantity),
            revenue=Decimal(str(r.revenue)).quantize(Decimal("0.01")),
        )
        for r in top_rows
    ]

    # 4. Low stock items
    low_stock_stmt = (
        select(Product)
        .options(joinedload(Product.category))
        .where(Product.stock <= Product.low_stock_threshold)
        .where(Product.is_active.is_(True))
        .order_by(Product.stock.asc())
    )
    low_stock_products = db.scalars(low_stock_stmt).unique().all()

    # 5. Admin calculations: profit & margin over requested period
    if user.role == UserRole.admin:
        period_rev_stmt = select(func.coalesce(func.sum(Sale.total_amount), 0)).where(Sale.created_at >= period_start)
        period_cost_stmt = select(func.coalesce(func.sum(Sale.total_cost), 0)).where(Sale.created_at >= period_start)

        p_rev = Decimal(str(db.scalar(period_rev_stmt) or 0)).quantize(Decimal("0.01"))
        p_cost = Decimal(str(db.scalar(period_cost_stmt) or 0)).quantize(Decimal("0.01"))
        profit = (p_rev - p_cost).quantize(Decimal("0.01"))

        if p_rev > Decimal("0.00"):
            margin_percent = ((profit / p_rev) * Decimal("100")).quantize(Decimal("0.1"))
        else:
            margin_percent = Decimal("0.0")

        return DashboardAdminSummary(
            revenue_today=revenue_today,
            revenue_7d=revenue_7d,
            revenue_30d=revenue_30d,
            profit=profit,
            margin_percent=margin_percent,
            daily_trend=daily_trend,
            top_products=top_products,
            low_stock=[ProductAdminResponse.model_validate(p) for p in low_stock_products],
        )

    # For staff, omit profit and margin_percent, and omit product costs
    return DashboardStaffSummary(
        revenue_today=revenue_today,
        revenue_7d=revenue_7d,
        revenue_30d=revenue_30d,
        daily_trend=daily_trend,
        top_products=top_products,
        low_stock=[ProductStaffResponse.model_validate(p) for p in low_stock_products],
    )
