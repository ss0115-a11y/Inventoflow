# Smart Inventory & Sales Dashboard — Project Context

## Stack (do not substitute)
- Backend: Python 3.11+, FastAPI, SQLAlchemy 2.0 (typed style), Pydantic v2, PyJWT, bcrypt for password hashing, pytest
- Database: MySQL 8 via Docker Compose (only the DB is containerised; the API and frontend run locally)
- Frontend: React + TypeScript + Vite, Tailwind CSS, React Router, Recharts, axios, light/dark mode toggle
- Monorepo layout: /backend, /frontend, docker-compose.yml, README.md, PROJECT_CONTEXT.md

## Roles
- admin: full access, including cost price, profit figures, product create/edit/delete, CSV export, user list
- staff: can view products, record sales, add stock, and see the low-stock list. Staff must NOT see cost price or profit anywhere, and must NOT be able to edit prices or delete products. Enforce this on the backend, not only in the UI.

## Features (in scope)
1. JWT login (admin/staff)
2. Products with categories: CRUD, text search, category filter, pagination
3. Stock management: every stock change is recorded in a stock_movements table (type: purchase, sale, adjustment; signed quantity; reason; user; timestamp)
4. Sales entry (POS style): a sale has multiple line items; unit price and unit cost are snapshotted per line item at sale time so historical profit stays correct if prices change later
5. Low-stock alerts: a product is low when stock <= low_stock_threshold
6. Dashboard: revenue (today / last 7 days / last 30 days), gross profit and margin %, daily sales trend, top 5 sellers, low-stock list
7. CSV export of products and sales (admin only, sales export accepts a date range)

## Out of scope
Barcode scanning, purchase orders, suppliers, multi-store, payments, offline mode, deployment.

## Engineering rules
- Money uses Decimal / DECIMAL(10,2), never float
- All endpoints live under /api, return consistent JSON errors, and use proper HTTP status codes
- Recording a sale runs in one DB transaction, locks the product rows, and rejects the sale with 400 if any item lacks stock
- Secrets and DB credentials come from .env (provide .env.example), nothing hardcoded
- Keep code simple and readable, with small modules, no over-engineering, and no unrequested features
- After each phase, run what you built (start the server, hit the endpoints, or run the build) and fix errors before telling me it's done
- At the end of each phase, give me a 5-line summary of what exists and the exact command to run it
