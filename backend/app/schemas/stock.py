from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field
from app.models.models import MovementType


class StockAdjustRequest(BaseModel):
    type: Literal["purchase", "adjustment"]
    quantity: int = Field(description="Signed quantity: positive to add stock, negative to reduce (admin only)")
    reason: str | None = Field(default=None, max_length=255)


class StockMovementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    user_id: int | None
    type: MovementType
    quantity: int
    reason: str | None
    created_at: datetime
    user_name: str | None = None
