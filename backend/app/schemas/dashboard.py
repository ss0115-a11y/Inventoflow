from decimal import Decimal
from pydantic import BaseModel, ConfigDict
from app.schemas.product import ProductStaffResponse, ProductAdminResponse


class DailyTrendItem(BaseModel):
    date: str
    revenue: Decimal
    orders: int


class TopProductItem(BaseModel):
    product_id: int
    name: str
    sku: str
    quantity_sold: int
    revenue: Decimal


# Staff summary: specifically omits profit and margin_percent
class DashboardStaffSummary(BaseModel):
    revenue_today: Decimal
    revenue_7d: Decimal
    revenue_30d: Decimal
    daily_trend: list[DailyTrendItem]
    top_products: list[TopProductItem]
    low_stock: list[ProductStaffResponse]


# Admin summary: includes profit and margin_percent
class DashboardAdminSummary(BaseModel):
    revenue_today: Decimal
    revenue_7d: Decimal
    revenue_30d: Decimal
    profit: Decimal
    margin_percent: Decimal
    daily_trend: list[DailyTrendItem]
    top_products: list[TopProductItem]
    low_stock: list[ProductAdminResponse]
