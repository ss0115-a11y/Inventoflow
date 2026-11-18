from app.schemas.auth import LoginRequest, UserResponse, TokenResponse
from app.schemas.category import CategoryCreate, CategoryResponse
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductStaffResponse,
    ProductAdminResponse,
    PaginatedProductsStaff,
    PaginatedProductsAdmin,
)
from app.schemas.stock import StockAdjustRequest, StockMovementResponse
from app.schemas.sale import (
    SaleItemCreate,
    SaleCreate,
    SaleItemStaffResponse,
    SaleItemAdminResponse,
    SaleStaffResponse,
    SaleAdminResponse,
    PaginatedSalesStaff,
    PaginatedSalesAdmin,
)
from app.schemas.dashboard import (
    DailyTrendItem,
    TopProductItem,
    DashboardStaffSummary,
    DashboardAdminSummary,
)
