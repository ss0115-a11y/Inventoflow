"""
Comprehensive Smoke Test for Smart Inventory & Sales Dashboard API.
Tests live endpoints, authentication, role restrictions, inventory CRUD, stock adjustments,
sale creation with stock decrement, 400 rejection on insufficient stock, and CSV streaming exports.
"""

import sys
import time
import httpx

BASE_URL = "http://localhost:8001/api"

def print_result(name: str, passed: bool, detail: str = ""):
    status = "[PASS]" if passed else "[FAIL]"
    msg = f"{status} - {name}"
    if detail:
        msg += f" ({detail})"
    print(msg)
    if not passed:
        sys.exit(1)

def run_smoke_test():
    print(f"\n--- Running Live Smoke Test against {BASE_URL} ---")
    client = httpx.Client(base_url=BASE_URL, timeout=10.0)

    # 1. Health check
    res = client.get("/health")
    print_result("API Health Check", res.status_code == 200 and res.json().get("status") == "ok")

    # 2. Admin Authentication
    admin_login = client.post("/auth/login", json={"email": "admin@shop.com", "password": "Admin@123"})
    print_result("Admin Login", admin_login.status_code == 200, f"role={admin_login.json().get('user', {}).get('role')}")
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 3. Staff Authentication
    staff_login = client.post("/auth/login", json={"email": "staff@shop.com", "password": "Staff@123"})
    print_result("Staff Login", staff_login.status_code == 200, f"role={staff_login.json().get('user', {}).get('role')}")
    staff_token = staff_login.json()["access_token"]
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    # 4. Role-based Dashboard Access
    admin_dash = client.get("/dashboard/summary?days=7", headers=admin_headers)
    has_profit_admin = "profit" in admin_dash.json() and "margin_percent" in admin_dash.json()
    print_result("Admin Dashboard includes Profit & Margin %", admin_dash.status_code == 200 and has_profit_admin)

    staff_dash = client.get("/dashboard/summary?days=7", headers=staff_headers)
    staff_dash_json = staff_dash.json()
    omitted_profit_staff = ("profit" not in staff_dash_json or staff_dash_json.get("profit") is None) and \
                           ("margin_percent" not in staff_dash_json or staff_dash_json.get("margin_percent") is None)
    print_result("Staff Dashboard omits Profit & Margin %", staff_dash.status_code == 200 and omitted_profit_staff)

    # 5. Role-based Product Catalog Access
    admin_prods = client.get("/products", headers=admin_headers)
    admin_first_prod = admin_prods.json()["items"][0]
    print_result("Admin Product includes Cost Price", "cost" in admin_first_prod and admin_first_prod["cost"] is not None)

    staff_prods = client.get("/products", headers=staff_headers)
    staff_first_prod = staff_prods.json()["items"][0]
    print_result("Staff Product omits Cost Price", "cost" not in staff_first_prod or staff_first_prod.get("cost") is None)

    # 6. Admin Create Product
    new_sku = f"SMOKE-TEST-{int(time.time())}"
    create_payload = {
        "sku": new_sku,
        "name": "Smoke Test Wireless Adapter",
        "category_id": None,
        "price": "999.00",
        "cost": "600.00",
        "stock": 10,
        "low_stock_threshold": 5
    }
    create_res = client.post("/products", json=create_payload, headers=admin_headers)
    print_result("Admin Create Product", create_res.status_code == 201)
    new_prod_id = create_res.json()["id"]

    # 7. Staff Forbidden from Creating Product
    staff_create_res = client.post("/products", json=create_payload, headers=staff_headers)
    print_result("Staff Forbidden from Product Creation (403)", staff_create_res.status_code == 403)

    # 8. Add Stock (Usable by both Staff and Admin)
    stock_res = client.post(f"/products/{new_prod_id}/stock", json={
        "type": "purchase",
        "quantity": 15,
        "reason": "Restock shipment from smoke test"
    }, headers=staff_headers)
    updated_stock = stock_res.json().get("stock")
    print_result("Add Stock (+15 units)", stock_res.status_code == 200 and updated_stock == 25, f"new_stock={updated_stock}")

    # 9. Sale Checkout & Stock Decrement
    sale_res = client.post("/sales", json={
        "items": [{"product_id": new_prod_id, "quantity": 5}]
    }, headers=staff_headers)
    print_result("POS Sale Checkout", sale_res.status_code == 201)

    # Verify product stock decremented from 25 to 20
    check_prod = client.get(f"/products/{new_prod_id}", headers=admin_headers)
    print_result("Stock Decremented after Sale", check_prod.json()["stock"] == 20, f"remaining={check_prod.json()['stock']}")

    # 10. Insufficient Stock Rejection (HTTP 400 with product name)
    over_sale = client.post("/sales", json={
        "items": [{"product_id": new_prod_id, "quantity": 9999}]
    }, headers=staff_headers)
    error_detail = over_sale.json().get("detail", "")
    has_prod_name = "Smoke Test Wireless Adapter" in error_detail or "SMOKE-TEST-001" in error_detail
    print_result("Insufficient Stock Rejected with 400 & Product Name", over_sale.status_code == 400 and has_prod_name, f"detail={error_detail}")

    # 11. Export CSV (Admin Allowed, Staff Forbidden)
    csv_admin = client.get("/export/products.csv", headers=admin_headers)
    print_result("Admin Export Products CSV", csv_admin.status_code == 200 and "text/csv" in csv_admin.headers.get("content-type", ""))

    csv_staff = client.get("/export/products.csv", headers=staff_headers)
    print_result("Staff Forbidden from CSV Export (403)", csv_staff.status_code == 403)

    # Clean up test product
    client.delete(f"/products/{new_prod_id}", headers=admin_headers)

    print("\n[SUCCESS] ALL SMOKE TESTS PASSED SUCCESSFULLY!\n")

if __name__ == "__main__":
    run_smoke_test()
