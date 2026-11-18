# Backend API - Smart Inventory & Sales Dashboard

> **Note on Port Configuration:**
> In this setup, the FastAPI backend API runs on **port 8001** (`http://localhost:8001`).
> All API endpoints are prefixed with `/api` (e.g., `http://localhost:8001/api/health`).

## Running the API
From the `backend/` directory:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```
