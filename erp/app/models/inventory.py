from datetime import datetime
from ..extensions import db


class Warehouse(db.Model):
    __tablename__ = 'warehouses'
    id = db.Column(db.Integer, primary_key=True)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(255))
    is_active = db.Column(db.Boolean, default=True)


class Category(db.Model):
    __tablename__ = 'categories'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=True)


class Product(db.Model):
    __tablename__ = 'products'
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(30), unique=True, nullable=False)
    barcode = db.Column(db.String(50), unique=True, nullable=True)
    name_ar = db.Column(db.String(150), nullable=False)
    name_en = db.Column(db.String(150))
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=True)
    unit = db.Column(db.String(20), default='PCS')  # KG / PCS / BOX / L
    sale_price = db.Column(db.Numeric(15, 3), nullable=False, default=0)
    cost_price = db.Column(db.Numeric(15, 3), default=0)
    reorder_level = db.Column(db.Numeric(15, 3), default=0)
    vat_rate = db.Column(db.Numeric(5, 2), default=5)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    batches = db.relationship('ProductBatch', backref='product', lazy='dynamic')


class ProductBatch(db.Model):
    __tablename__ = 'product_batches'
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    warehouse_id = db.Column(db.Integer, db.ForeignKey('warehouses.id'), nullable=False)
    batch_no = db.Column(db.String(50))
    expiry_date = db.Column(db.Date, nullable=True)
    qty_on_hand = db.Column(db.Numeric(15, 3), default=0)
    unit_cost = db.Column(db.Numeric(15, 3), default=0)
    landed_cost = db.Column(db.Numeric(15, 3), default=0)

    warehouse = db.relationship('Warehouse', backref='batches')


class StockMovement(db.Model):
    __tablename__ = 'stock_movements'
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    batch_id = db.Column(db.Integer, db.ForeignKey('product_batches.id'), nullable=True)
    warehouse_id = db.Column(db.Integer, db.ForeignKey('warehouses.id'), nullable=False)
    type = db.Column(db.String(10), nullable=False)  # IN / OUT / ADJUSTMENT
    qty = db.Column(db.Numeric(15, 3), nullable=False)
    reference = db.Column(db.String(50))
    source = db.Column(db.String(20))  # SALE / PURCHASE / TRANSFER / MANUAL
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class StockTransfer(db.Model):
    __tablename__ = 'stock_transfers'
    id = db.Column(db.Integer, primary_key=True)
    from_warehouse_id = db.Column(db.Integer, db.ForeignKey('warehouses.id'), nullable=False)
    to_warehouse_id = db.Column(db.Integer, db.ForeignKey('warehouses.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(20), default='PENDING')
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)


class StockTransferItem(db.Model):
    __tablename__ = 'stock_transfer_items'
    id = db.Column(db.Integer, primary_key=True)
    transfer_id = db.Column(db.Integer, db.ForeignKey('stock_transfers.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    batch_id = db.Column(db.Integer, db.ForeignKey('product_batches.id'), nullable=True)
    qty = db.Column(db.Numeric(15, 3), nullable=False)
