# InventoFlow — Smart Inventory & Sales Dashboard

> A high-performance, real-time inventory management, point-of-sale (POS) terminal, and business intelligence analytics platform built with FastAPI, React, TypeScript, and Tailwind CSS.

---

## Table of Contents
- [Overview & Features](#overview--features)
- [Tech Stack](#tech-stack)
- [Database Architecture (ER Diagram)](#database-architecture-er-diagram)
- [Prerequisites](#prerequisites)
- [Quick Start Guide](#quick-start-guide)
- [Environment Variables](#environment-variables)
- [Demo Credentials](#demo-credentials)
- [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
- [API Endpoints Reference](#api-endpoints-reference)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [Screenshots](#screenshots)
- [2-Minute Demo Script](#2-minute-demo-script)

---

## Overview & Features

InventoFlow provides complete visibility over stock flows, retail checkout transactions, and business profitability. Designed for modern multi-role retail environments, it enforces strict role-based access control (RBAC) so cashier staff can execute point-of-sale operations and restock without viewing unit acquisition costs or company profit margins.

### Key Capabilities
- **Role-Based Security**: Complete data isolation. Staff users cannot view cost prices, profit figures, profit margins, export data, or delete products.
- **Real-Time POS Terminal**: Fast product search, live cart controls, instant stock deduction inside a single atomic database transaction, and deadlock-free row locking (`with_for_update`).
- **Stock Movement Ledger**: Every stock change (purchases, POS sales, and physical audit adjustments) is immutably logged in a `stock_movements` audit ledger.
- **Low-Stock Alerting**: Automated monitoring flagging products at or below their configurable `low_stock_threshold` with red (out of stock) and amber (low stock) badges and 1-click restock actions.
- **Executive BI Dashboard**: Real-time sales metrics across Today, 7 Days, and 30 Days, interactive Recharts sales volume trend areas, and top 5 best seller rankings.
- **CSV Data Export**: Authenticated streaming downloads for product catalogs and time-ranged sales reports.
- **Theme Support**: Seamless Light and Dark mode with system preference auto-detection and persistence.

---

## Tech Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Backend API** | FastAPI (Python 3.11+) | Asynchronous REST API with Pydantic v2 validation |
| **ORM & DB Engine** | SQLAlchemy 2.0 (Typed) | Transactional integrity, row-level locking, migrations |
| **Database** | MySQL 8.0 / SQLite | Containerized MySQL via Docker Compose or native SQLite |
| **Security & Auth** | PyJWT & Passlib / Bcrypt | JWT Bearer authentication with 60-minute expiration |
| **Frontend Framework** | React 18 + TypeScript | Built with Vite for instant HMR and optimized production bundles |
| **Styling & Theme** | Tailwind CSS v3 | Custom dark mode using `class` strategy, Plus Jakarta Sans typography |
| **State & Navigation** | React Router DOM v7 | Protected route wrappers, redirect preservation |
| **Data Visualization** | Recharts | Responsive Area charts and ranking visualizations |
| **HTTP Client** | Axios | Interceptors for JWT attachment and 401 redirect handling |
| **Testing** | Pytest + HTTPX | In-memory SQLite unit tests and live end-to-end smoke test |

---

## Database Architecture (ER Diagram)

The relational schema snapshots `unit_price` and `unit_cost` at the moment of sale into `sale_items`, ensuring historical profit accuracy even if supplier costs or catalog prices change later.

```mermaid
erDiagram
    users ||--o{ sales : "processes"
    users ||--o{ stock_movements : "records"
    categories ||--o{ products : "categorizes"
    products ||--o{ sale_items : "sold_in"
    products ||--o{ stock_movements : "tracked_in"
    sales ||--|{ sale_items : "contains"

    users {
        bigint id PK
        string name
        string email UK
        string password_hash
        string role "admin | staff"
        boolean is_active
        datetime created_at
    }

    categories {
        bigint id PK
        string name UK
    }

    products {
        bigint id PK
        string sku UK
        string name
        bigint category_id FK
        decimal price "Selling price (10,2)"
        decimal cost "Acquisition cost (10,2)"
        integer stock "Current on-hand units"
        integer low_stock_threshold
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    stock_movements {
        bigint id PK
        bigint product_id FK
        bigint user_id FK
        string type "purchase | sale | adjustment"
        integer quantity "Signed: + in, - out"
        string reason
        datetime created_at
    }

    sales {
        bigint id PK
        bigint user_id FK
        decimal total_amount "Total revenue (10,2)"
        decimal total_cost "Total cost (10,2)"
        datetime created_at
    }

    sale_items {
        bigint id PK
        bigint sale_id FK
        bigint product_id FK
        integer quantity
        decimal unit_price "Snapshotted price (10,2)"
        decimal unit_cost "Snapshotted cost (10,2)"
        decimal line_total "quantity * unit_price (10,2)"
    }
```

---

## Prerequisites

Before setting up the project, ensure you have the following installed:
- **Python**: Version `3.11` or later (`python --version`)
- **Node.js**: Version `18` or later (`node --version`)
- **Docker & Docker Compose** (Optional, required only for containerized MySQL; SQLite works out-of-the-box)

---

## Quick Start Guide

Follow these steps from a fresh clone to get the backend and frontend up and running:

### Step 1: Database Setup
#### Option A: Using Docker Compose (MySQL 8)
```bash
docker compose up -d
```

#### Option B: Using SQLite (Zero External Dependencies)
Configure `DATABASE_URL=sqlite:///./inventory.db` in `backend/.env`.

---

### Step 2: Backend Setup & Seed
1. Create and activate a Python virtual environment:
   ```bash
   # Windows (PowerShell)
   python -m venv backend/venv
   .\backend\venv\Scripts\Activate.ps1

   # Linux / macOS
   python3 -m venv backend/venv
   source backend/venv/bin/activate
   ```

2. Install backend dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```

3. Configure environment file:
   ```bash
   cp backend/.env.example backend/.env
   ```

4. Seed the database with sample products, categories, historical sales, and demo accounts:
   ```bash
   python backend/seed_db.py
   ```

5. Launch the FastAPI server on port 8001:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload --app-dir backend
   ```
   *The API will be available at `http://localhost:8001/api` (Swagger docs at `http://localhost:8001/docs`).*

---

### Step 3: Frontend Setup
1. Open a new terminal and navigate to `/frontend`:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment file:
   ```bash
   cp .env.example .env
   ```

4. Launch the Vite development server:
   ```bash
   npm run dev
   ```
   *Open `http://localhost:5173` in your browser.*

---

## Environment Variables

### Backend (`backend/.env`)
| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `sqlite:///./inventory.db` or `mysql+pymysql://inventory_user:changeme@localhost:3306/inventory_db` | Database connection string |
| `JWT_SECRET` | `super_secret_jwt_key_change_in_production` | Secret key used for signing JWT tokens |
| `JWT_ALGORITHM` | `HS256` | Token signing algorithm |
| `JWT_EXPIRE_MINUTES` | `60` | Token expiration duration |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allowed frontend origins |

### Frontend (`frontend/.env`)
| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `http://localhost:8001/api` | Base URL of the backend API |
| `VITE_CURRENCY` | `₹` | Currency symbol used across all tables and charts |

---

## Demo Credentials

The database seed provides two pre-configured user accounts:

| Role | Email | Password | Intended Use |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@shop.com` | `Admin@123` | Full access: costs, profit, margin %, catalog CRUD, CSV exports |
| **Staff** | `staff@shop.com` | `Staff@123` | Operational access: POS terminal, stock view & restock, hidden costs |

---

## Role-Based Access Control (RBAC)

Role restrictions are enforced on the backend via Pydantic response schemas and security dependencies, not merely hidden in the frontend UI.

| Feature / Action | Admin | Staff | Security Enforcement |
| :--- | :---: | :---: | :--- |
| View Product Catalog & Stock | Yes | Yes | All users can view inventory levels |
| View Product Cost Price (`cost`) | Yes | **No** | Backend strips `cost` from `ProductStaffResponse` |
| Create & Edit Products | Yes | **No** | `require_admin` dependency returns HTTP 403 for Staff |
| Delete / Deactivate Products | Yes | **No** | `require_admin` dependency returns HTTP 403 for Staff |
| Restock Product (`POST /stock`) | Yes | Yes | Both roles can replenish inventory |
| POS Sales Checkout (`POST /sales`) | Yes | Yes | Both roles can process sales |
| View Sales History | All Sales | Own Sales | Staff query filtered by `user_id == current_user.id` |
| View Total Cost on Sales (`total_cost`) | Yes | **No** | Backend strips costs from `SaleStaffResponse` |
| Dashboard Revenue (Today, 7d, 30d) | Yes | Yes | Both roles view top-line revenue velocity |
| Dashboard Gross Profit & Margin % | Yes | **No** | Backend omits `profit` and `margin_percent` from Staff |
| Export Products CSV | Yes | **No** | Admin streaming endpoint returns HTTP 403 for Staff |
| Export Sales CSV | Yes | **No** | Admin streaming endpoint returns HTTP 403 for Staff |

---

## API Endpoints Reference

All endpoints are hosted under `/api`.

| Module | Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Meta** | `GET` | `/api/health` | Public | Health and DB connectivity check |
| **Auth** | `POST` | `/api/auth/login` | Public | Authenticates credentials and returns JWT token |
| **Auth** | `GET` | `/api/auth/me` | Authenticated | Returns current profile and role information |
| **Categories** | `GET` | `/api/categories` | Authenticated | List all inventory categories |
| **Categories** | `POST` | `/api/categories` | Admin Only | Create a new category |
| **Products** | `GET` | `/api/products` | Authenticated | Search, category filter, pagination (omits cost for staff) |
| **Products** | `POST` | `/api/products` | Admin Only | Create new product |
| **Products** | `GET` | `/api/products/{id}` | Authenticated | Retrieve product details (omits cost for staff) |
| **Products** | `PUT` | `/api/products/{id}` | Admin Only | Update product attributes, price, cost |
| **Products** | `DELETE` | `/api/products/{id}` | Admin Only | Soft delete / deactivate product |
| **Stock** | `POST` | `/api/products/{id}/stock` | Authenticated | Record stock purchase or adjustment |
| **Stock** | `GET` | `/api/products/{id}/movements`| Authenticated | Audit history of stock movements for product |
| **Sales** | `POST` | `/api/sales` | Authenticated | Process atomic POS sale, deducts stock |
| **Sales** | `GET` | `/api/sales` | Authenticated | Paginated sales list (filtered to user's sales for staff) |
| **Sales** | `GET` | `/api/sales/{id}` | Authenticated | Detailed sale invoice with line items |
| **Dashboard** | `GET` | `/api/dashboard/summary` | Authenticated | KPIs, trend, top 5, low-stock (profit omitted for staff) |
| **Export** | `GET` | `/api/export/products.csv` | Admin Only | Stream products table as CSV attachment |
| **Export** | `GET` | `/api/export/sales.csv` | Admin Only | Stream filtered sales table as CSV attachment |

---

## Testing & Quality Assurance

### 1. Backend Unit & Integration Tests (Pytest)
Run the automated test suite using an in-memory SQLite database:
```bash
pytest backend/tests
```
*Tests cover auth token generation, password hashing, product CRUD, staff cost redaction, and atomic transactions.*

### 2. Live Smoke Test
With the backend server running on port 8001, execute the live end-to-end smoke test script:
```bash
python smoke_test.py
```
*Validates 14 verification points including live login, role isolation, inventory adjustments, POS checkout, stock deductions, 400 rejection on insufficient stock with product name, and CSV permissions.*

### 3. Frontend Typecheck & Production Build
Ensure zero TypeScript errors and verify production asset bundling:
```bash
cd frontend && npm run build
```

---

## Screenshots

### 1. Executive Dashboard (Admin View)
*Shows gross revenue, gross profit, margin %, daily trend area chart, top 5 sellers, and low-stock alerts.*
![Executive Dashboard Placeholder](https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80)

### 2. POS Checkout Terminal
*Real-time product catalog search, live cart controls, quantity adjustments, and checkout feedback.*
![POS Checkout Placeholder](https://images.unsplash.com/photo-1556742049-0a67c5574f73?auto=format&fit=crop&w=1200&q=80)

### 3. Inventory Management & Stock Modal
*Filterable catalog with low-stock tinting, admin cost columns, and 1-click restock modal.*
![Inventory Catalog Placeholder](https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80)

---

## 2-Minute Demo Script

Follow this walkthrough to demonstrate all features in 2 minutes:

| Step | Action | What to Observe |
| :--- | :--- | :--- |
| **1. Admin Login** | Go to `http://localhost:5173/login` and click **"Admin Portal"** (or enter `admin@shop.com` / `Admin@123`). | Instant login redirecting to the Executive Dashboard. |
| **2. Executive KPIs** | Review the top row KPI cards and switch the **7 Days / 30 Days** toggle. | Notice **Gross Profit** and **Margin %** cards are prominently displayed with full numbers. |
| **3. Inventory & Cost** | Click **"Inventory"** in the sidebar. | Observe the **Cost Price** column, **Export CSV** button, and **Add Product** action. |
| **4. POS Sale** | Click **"Point of Sale (POS)"** in the sidebar. Search `Headphones`, add to basket, and click **"Complete Sale"**. | Success toast appears. Stock decrements immediately in catalog, and the order is logged below. |
| **5. Insufficient Stock** | Attempt to add a product beyond available quantity and checkout. | Clear error toast and banner appear with the **exact product name and SKU**. |
| **6. Switch to Staff** | Click Logout in the sidebar. Click **"Staff Portal"** (`staff@shop.com` / `Staff@123`). | Top bar displays green **"Staff"** badge. |
| **7. Verify Restrictions** | On Dashboard, observe **Gross Profit and Margin % are hidden**. In Inventory, observe **Cost Price column and Export CSV button are completely removed**. | Staff can still process sales and click **"Add Stock"** without seeing business financials. |
| **8. Export CSV** | Switch back to Admin, navigate to Inventory, and click **"Export CSV"**. | Browser downloads `products.csv` via authenticated Axios blob stream. |

---

## License
MIT License. Built for full-stack inventory and point-of-sale assessment.
