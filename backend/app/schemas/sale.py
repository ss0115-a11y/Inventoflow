from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field


class SaleItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)


class SaleCreate(BaseModel):
    items: list[SaleItemCreate] = Field(min_length=1)


# Staff line item: NO unit_cost
class SaleItemStaffResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sale_id: int
    product_id: int | None
    product_name: str | None = None
    product_sku: str | None = None
    quantity: int
    unit_price: Decimal
    line_total: Decimal


# Admin line item: includes unit_cost
class SaleItemAdminResponse(SaleItemStaffResponse):
    unit_cost: Decimal


# Staff sale response: NO total_cost
class SaleStaffResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int | None
    user_name: str | None = None
    total_amount: Decimal
    created_at: datetime
    items: list[SaleItemStaffResponse]


# Admin sale response: includes total_cost
class SaleAdminResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int | None
    user_name: str | None = None
    total_amount: Decimal
    total_cost: Decimal
    created_at: datetime
    items: list[SaleItemAdminResponse]


class PaginatedSalesStaff(BaseModel):
    items: list[SaleStaffResponse]
    total: int
    page: int
    page_size: int
    pages: int


class PaginatedSalesAdmin(BaseModel):
    items: list[SaleAdminResponse]
    total: int
    page: int
    page_size: int
    pages: int
