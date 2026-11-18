from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.category import CategoryResponse


class ProductCreate(BaseModel):
    sku: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=255)
    category_id: int | None = None
    price: Decimal = Field(gt=Decimal("0.00"), decimal_places=2)
    cost: Decimal = Field(ge=Decimal("0.00"), decimal_places=2)
    stock: int = Field(default=0, ge=0)
    low_stock_threshold: int = Field(default=10, ge=0)


class ProductUpdate(BaseModel):
    sku: str | None = Field(default=None, min_length=1, max_length=100)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    category_id: int | None = None
    price: Decimal | None = Field(default=None, gt=Decimal("0.00"), decimal_places=2)
    cost: Decimal | None = Field(default=None, ge=Decimal("0.00"), decimal_places=2)
    stock: int | None = Field(default=None, ge=0)
    low_stock_threshold: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


# Staff response - specifically omits cost
class ProductStaffResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sku: str
    name: str
    category_id: int | None
    category: CategoryResponse | None = None
    price: Decimal
    stock: int
    low_stock_threshold: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


# Admin response - includes cost
class ProductAdminResponse(ProductStaffResponse):
    cost: Decimal


class PaginatedProductsStaff(BaseModel):
    items: list[ProductStaffResponse]
    total: int
    page: int
    page_size: int
    pages: int


class PaginatedProductsAdmin(BaseModel):
    items: list[ProductAdminResponse]
    total: int
    page: int
    page_size: int
    pages: int
