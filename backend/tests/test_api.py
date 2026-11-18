from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app.models.models import User, Category, Product, UserRole
from app.core.security import hash_password

# In-memory SQLite engine with StaticPool so all connections share the same memory DB
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=test_engine)
    app.dependency_overrides[get_db] = override_get_db

    # Seed test users and default category
    db = TestingSessionLocal()
    admin_user = User(
        name="Admin User",
        email="admin@example.com",
        password_hash=hash_password("admin123"),
        role=UserRole.admin,
        is_active=True,
    )
    staff_user = User(
        name="Staff User",
        email="staff@example.com",
        password_hash=hash_password("staff123"),
        role=UserRole.staff,
        is_active=True,
    )
    cat = Category(name="General")
    db.add_all([admin_user, staff_user, cat])
    db.commit()
    db.close()

    yield

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def client():
    return TestClient(app)


def get_token(client: TestClient, email: str, password: str) -> str:
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def test_login_success_and_failure(client: TestClient):
    # 1. Success
    res = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "admin123"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "admin@example.com"
    assert data["user"]["role"] == "admin"

    # 2. Failure: wrong password
    res_wrong_pw = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "wrong"})
    assert res_wrong_pw.status_code == 401
    assert "Invalid email or password" in res_wrong_pw.json()["detail"]

    # 3. Failure: non-existent email
    res_no_user = client.post("/api/auth/login", json={"email": "missing@example.com", "password": "password"})
    assert res_no_user.status_code == 401


def test_staff_forbidden_on_product_create(client: TestClient):
    staff_token = get_token(client, "staff@example.com", "staff123")
    admin_token = get_token(client, "admin@example.com", "admin123")

    product_payload = {
        "sku": "PROD-101",
        "name": "Widget A",
        "price": "29.99",
        "cost": "15.00",
        "stock": 10,
        "low_stock_threshold": 5,
    }

    # Staff attempt -> 403 Forbidden
    res_staff = client.post(
        "/api/products",
        json=product_payload,
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert res_staff.status_code == 403
    assert "Admin privileges required" in res_staff.json()["detail"]

    # Admin attempt -> 201 Created
    res_admin = client.post(
        "/api/products",
        json=product_payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_admin.status_code == 201
    assert res_admin.json()["sku"] == "PROD-101"


def test_staff_product_response_has_no_cost_field(client: TestClient):
    admin_token = get_token(client, "admin@example.com", "admin123")
    staff_token = get_token(client, "staff@example.com", "staff123")

    # Create product as admin
    res_create = client.post(
        "/api/products",
        json={
            "sku": "COST-001",
            "name": "Secret Cost Item",
            "price": "50.00",
            "cost": "20.00",
            "stock": 15,
            "low_stock_threshold": 3,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_create.status_code == 201
    prod_id = res_create.json()["id"]

    # Staff calls GET /api/products (list)
    res_staff_list = client.get("/api/products", headers={"Authorization": f"Bearer {staff_token}"})
    assert res_staff_list.status_code == 200
    items = res_staff_list.json()["items"]
    assert len(items) >= 1
    assert "cost" not in items[0], "Staff must NOT see cost in product list"

    # Staff calls GET /api/products/{id} (single)
    res_staff_single = client.get(f"/api/products/{prod_id}", headers={"Authorization": f"Bearer {staff_token}"})
    assert res_staff_single.status_code == 200
    assert "cost" not in res_staff_single.json(), "Staff must NOT see cost in single product view"

    # Admin calls GET /api/products/{id} -> cost is present
    res_admin_single = client.get(f"/api/products/{prod_id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_admin_single.status_code == 200
    assert "cost" in res_admin_single.json()
    assert Decimal(str(res_admin_single.json()["cost"])) == Decimal("20.00")


def test_sale_decrements_stock_and_writes_movement(client: TestClient):
    admin_token = get_token(client, "admin@example.com", "admin123")
    staff_token = get_token(client, "staff@example.com", "staff123")

    # Create product with initial stock 20
    prod = client.post(
        "/api/products",
        json={
            "sku": "SALE-001",
            "name": "Selling Item",
            "price": "10.00",
            "cost": "4.00",
            "stock": 20,
            "low_stock_threshold": 5,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    ).json()

    # Staff sells 5 units
    res_sale = client.post(
        "/api/sales",
        json={"items": [{"product_id": prod["id"], "quantity": 5}]},
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert res_sale.status_code == 201
    sale_data = res_sale.json()
    assert Decimal(str(sale_data["total_amount"])) == Decimal("50.00")
    assert "total_cost" not in sale_data, "Staff response must NOT include total_cost"

    # Verify stock decremented to 15
    res_prod = client.get(f"/api/products/{prod['id']}", headers={"Authorization": f"Bearer {staff_token}"})
    assert res_prod.json()["stock"] == 15

    # Verify stock movements: initial + sale
    res_movements = client.get(f"/api/products/{prod['id']}/movements", headers={"Authorization": f"Bearer {staff_token}"})
    assert res_movements.status_code == 200
    movements = res_movements.json()
    sale_mov = next((m for m in movements if m["type"] == "sale"), None)
    assert sale_mov is not None
    assert sale_mov["quantity"] == -5


def test_sale_insufficient_stock_returns_400(client: TestClient):
    admin_token = get_token(client, "admin@example.com", "admin123")
    staff_token = get_token(client, "staff@example.com", "staff123")

    # Create product with stock 2
    prod = client.post(
        "/api/products",
        json={
            "sku": "LOW-002",
            "name": "Limited Item",
            "price": "15.00",
            "cost": "7.00",
            "stock": 2,
            "low_stock_threshold": 1,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    ).json()

    # Attempt to sell 5 units (available: 2)
    res_sale = client.post(
        "/api/sales",
        json={"items": [{"product_id": prod["id"], "quantity": 5}]},
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert res_sale.status_code == 400
    err_detail = res_sale.json()["detail"]
    assert "Limited Item" in err_detail or "LOW-002" in err_detail
    assert "Insufficient stock" in err_detail

    # Verify stock is still 2
    res_prod = client.get(f"/api/products/{prod['id']}", headers={"Authorization": f"Bearer {staff_token}"})
    assert res_prod.json()["stock"] == 2


def test_dashboard_summary_revenue(client: TestClient):
    admin_token = get_token(client, "admin@example.com", "admin123")
    staff_token = get_token(client, "staff@example.com", "staff123")

    # Create 2 products
    p1 = client.post(
        "/api/products",
        json={"sku": "DASH-1", "name": "Item One", "price": "25.00", "cost": "10.00", "stock": 50},
        headers={"Authorization": f"Bearer {admin_token}"},
    ).json()

    p2 = client.post(
        "/api/products",
        json={"sku": "DASH-2", "name": "Item Two", "price": "15.00", "cost": "5.00", "stock": 50},
        headers={"Authorization": f"Bearer {admin_token}"},
    ).json()

    # Record 2 sales: Sale 1 = 2 * $25 = $50; Sale 2 = 3 * $15 = $45. Total = $95.
    client.post(
        "/api/sales",
        json={"items": [{"product_id": p1["id"], "quantity": 2}]},
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    client.post(
        "/api/sales",
        json={"items": [{"product_id": p2["id"], "quantity": 3}]},
        headers={"Authorization": f"Bearer {staff_token}"},
    )

    # 1. Admin dashboard summary
    res_admin = client.get("/api/dashboard/summary?days=7", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_admin.status_code == 200
    data_admin = res_admin.json()
    assert Decimal(str(data_admin["revenue_today"])) == Decimal("95.00")
    assert Decimal(str(data_admin["revenue_7d"])) == Decimal("95.00")
    # Profit: Revenue $95 - Cost (2*10 + 3*5 = 35) = $60
    assert Decimal(str(data_admin["profit"])) == Decimal("60.00")
    assert "margin_percent" in data_admin
    assert len(data_admin["daily_trend"]) == 7
    assert len(data_admin["top_products"]) == 2

    # 2. Staff dashboard summary (omits profit & margin_percent)
    res_staff = client.get("/api/dashboard/summary?days=7", headers={"Authorization": f"Bearer {staff_token}"})
    assert res_staff.status_code == 200
    data_staff = res_staff.json()
    assert Decimal(str(data_staff["revenue_today"])) == Decimal("95.00")
    assert "profit" not in data_staff, "Staff must NOT see profit in dashboard"
    assert "margin_percent" not in data_staff, "Staff must NOT see margin_percent in dashboard"


def test_stock_negative_adjustment_admin_only(client: TestClient):
    admin_token = get_token(client, "admin@example.com", "admin123")
    staff_token = get_token(client, "staff@example.com", "staff123")

    prod = client.post(
        "/api/products",
        json={"sku": "ADJ-001", "name": "Adjust Item", "price": "10.00", "cost": "5.00", "stock": 20},
        headers={"Authorization": f"Bearer {admin_token}"},
    ).json()

    # Staff can add stock via purchase
    res_staff_add = client.post(
        f"/api/products/{prod['id']}/stock",
        json={"type": "purchase", "quantity": 5, "reason": "Restocked"},
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert res_staff_add.status_code == 200
    assert res_staff_add.json()["stock"] == 25

    # Staff attempt negative adjustment -> 403 Forbidden
    res_staff_neg = client.post(
        f"/api/products/{prod['id']}/stock",
        json={"type": "adjustment", "quantity": -5, "reason": "Damaged items"},
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert res_staff_neg.status_code == 403

    # Admin negative adjustment -> 200 OK
    res_admin_neg = client.post(
        f"/api/products/{prod['id']}/stock",
        json={"type": "adjustment", "quantity": -5, "reason": "Damaged items"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_admin_neg.status_code == 200
    assert res_admin_neg.json()["stock"] == 20


def test_export_csv_admin_only(client: TestClient):
    admin_token = get_token(client, "admin@example.com", "admin123")
    staff_token = get_token(client, "staff@example.com", "staff123")

    # Staff export attempt -> 403
    res_staff_prod = client.get("/api/export/products.csv", headers={"Authorization": f"Bearer {staff_token}"})
    assert res_staff_prod.status_code == 403

    res_staff_sales = client.get("/api/export/sales.csv", headers={"Authorization": f"Bearer {staff_token}"})
    assert res_staff_sales.status_code == 403

    # Admin export -> 200 with text/csv
    res_admin_prod = client.get("/api/export/products.csv", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_admin_prod.status_code == 200
    assert "text/csv" in res_admin_prod.headers["content-type"]
    assert "attachment; filename=\"products.csv\"" in res_admin_prod.headers["content-disposition"]
    assert "sku,name,category,price,cost" in res_admin_prod.text
