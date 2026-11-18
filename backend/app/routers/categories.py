from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app.models.models import Category, User
from app.core.dependencies import get_current_user, require_admin
from app.schemas.category import CategoryCreate, CategoryResponse

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryResponse])
def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Category).order_by(Category.name.asc())
    return db.scalars(stmt).all()


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    cat_in: CategoryCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    name = cat_in.name.strip()
    existing = db.scalar(select(Category).where(Category.name == name))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Category '{name}' already exists",
        )

    cat = Category(name=name)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat
