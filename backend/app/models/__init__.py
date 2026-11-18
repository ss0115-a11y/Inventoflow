# app/models/__init__.py
# Expose all models so Base.metadata.create_all sees them when imported.
from app.models.models import (  # noqa: F401
    BigIntPK,
    User,
    Category,
    Product,
    StockMovement,
    Sale,
    SaleItem,
    UserRole,
    MovementType,
)
