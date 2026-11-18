from datetime import datetime, timedelta
from decimal import Decimal
import random

from app.database import engine, SessionLocal, Base
from app.models.models import User, UserRole, Category, Product, StockMovement, MovementType, Sale, SaleItem
from app.core.security import hash_password

def seed():
    print("Dropping existing tables...")
    Base.metadata.drop_all(bind=engine)
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        print("Seeding users...")
        admin = User(
            name="Admin User",
            email="admin@shop.com",
            password_hash=hash_password("Admin@123"),
            role=UserRole.admin,
            is_active=True,
        )
        staff = User(
            name="Staff Member",
            email="staff@shop.com",
            password_hash=hash_password("Staff@123"),
            role=UserRole.staff,
            is_active=True,
        )
        db.add_all([admin, staff])
        db.flush()

        print("Seeding categories...")
        categories = {
            "Electronics": Category(name="Electronics"),
            "Accessories": Category(name="Accessories"),
            "Groceries": Category(name="Groceries"),
            "Office & Stationery": Category(name="Office & Stationery"),
            "Apparel": Category(name="Apparel"),
        }
        db.add_all(list(categories.values()))
        db.flush()

        print("Seeding products...")
        product_data = [
            ("ELEC-001", "Wireless Noise-Canceling Headphones", "Electronics", Decimal("3499.00"), Decimal("2100.00"), 45, 10),
            ("ELEC-002", "RGB Mechanical Gaming Keyboard", "Electronics", Decimal("2299.00"), Decimal("1400.00"), 30, 8),
            ("ELEC-003", "Ergonomic Optical Wireless Mouse", "Electronics", Decimal("799.00"), Decimal("450.00"), 4, 10), # low stock (amber)
            ("ELEC-004", "Ultra-fast USB-C Hub 7-in-1", "Electronics", Decimal("1899.00"), Decimal("1100.00"), 0, 5), # out of stock (red)
            ("ELEC-005", "Smart Fitness Tracker Band 6", "Electronics", Decimal("2499.00"), Decimal("1550.00"), 25, 10),
            ("ACC-001", "Braided 65W Fast Charging Cable", "Accessories", Decimal("349.00"), Decimal("150.00"), 3, 15), # low stock (amber)
            ("ACC-002", "Laptop Stand Aluminum Alloy", "Accessories", Decimal("1299.00"), Decimal("750.00"), 18, 5),
            ("ACC-003", "Wireless Charging Pad 15W", "Accessories", Decimal("899.00"), Decimal("480.00"), 2, 8), # low stock (red/amber)
            ("GROC-001", "Premium Arabica Coffee Beans 500g", "Groceries", Decimal("599.00"), Decimal("380.00"), 60, 20),
            ("GROC-002", "Pure Raw Wildflower Honey 1kg", "Groceries", Decimal("450.00"), Decimal("270.00"), 50, 15),
            ("GROC-003", "Organic Green Tea Bags 100pk", "Groceries", Decimal("320.00"), Decimal("180.00"), 35, 10),
            ("OFF-001", "Hardcover Executive Notebook A5", "Office & Stationery", Decimal("299.00"), Decimal("130.00"), 80, 20),
            ("OFF-002", "Gel Pen Luxury Gift Set 0.5mm", "Office & Stationery", Decimal("499.00"), Decimal("220.00"), 1, 10), # low stock (red)
            ("OFF-003", "Desk Organizer Mesh Metal", "Office & Stationery", Decimal("449.00"), Decimal("240.00"), 22, 5),
            ("APP-001", "Cotton Crew Neck T-Shirt Black (L)", "Apparel", Decimal("699.00"), Decimal("320.00"), 40, 10),
            ("APP-002", "Waterproof Daily Commuter Backpack", "Apparel", Decimal("1799.00"), Decimal("950.00"), 12, 5),
        ]

        products = []
        for sku, name, cat_name, price, cost, stock, threshold in product_data:
            p = Product(
                sku=sku,
                name=name,
                category_id=categories[cat_name].id,
                price=price,
                cost=cost,
                stock=stock,
                low_stock_threshold=threshold,
                is_active=True,
            )
            products.append(p)
            db.add(p)
        db.flush()

        # Initial stock movements for purchases
        for p in products:
            movement = StockMovement(
                product_id=p.id,
                user_id=admin.id,
                type=MovementType.purchase,
                quantity=p.stock + 20, # Initial stock intake
                reason="Initial inventory stock-in",
                created_at=datetime.now() - timedelta(days=35),
            )
            db.add(movement)

        print("Seeding past sales across 30 days...")
        now = datetime.now()
        # Create sales distribution over last 30 days
        for day_offset in range(30, -1, -1):
            sale_date = now - timedelta(days=day_offset, hours=random.randint(1, 10), minutes=random.randint(0, 59))
            # Number of sales per day
            num_sales = random.randint(2, 6) if day_offset > 0 else 4 # today has 4 sales
            for s_idx in range(num_sales):
                sale_time = sale_date + timedelta(minutes=s_idx * 45)
                seller = random.choice([admin, staff])
                sale = Sale(
                    user_id=seller.id,
                    total_amount=Decimal("0.00"),
                    total_cost=Decimal("0.00"),
                    created_at=sale_time,
                )
                db.add(sale)
                db.flush()

                # Pick 1-3 items per sale
                sample_products = random.sample(products, k=random.randint(1, 3))
                tot_amount = Decimal("0.00")
                tot_cost = Decimal("0.00")
                for prod in sample_products:
                    qty = random.randint(1, 3)
                    line_total = (prod.price * qty).quantize(Decimal("0.01"))
                    line_cost = (prod.cost * qty).quantize(Decimal("0.01"))
                    tot_amount += line_total
                    tot_cost += line_cost
                    item = SaleItem(
                        sale_id=sale.id,
                        product_id=prod.id,
                        quantity=qty,
                        unit_price=prod.price,
                        unit_cost=prod.cost,
                        line_total=line_total,
                    )
                    db.add(item)
                    # Add stock movement
                    mv = StockMovement(
                        product_id=prod.id,
                        user_id=seller.id,
                        type=MovementType.sale,
                        quantity=-qty,
                        reason=f"Sale #{sale.id}",
                        created_at=sale_time,
                    )
                    db.add(mv)
                sale.total_amount = tot_amount
                sale.total_cost = tot_cost

        db.commit()
        print("Database successfully seeded!")
        print("Admin user: admin@shop.com / Admin@123")
        print("Staff user: staff@shop.com / Staff@123")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed()
