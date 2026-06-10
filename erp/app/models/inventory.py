from datetime import datetime
from ..extensions import db


class Warehouse(db.Model):
    __tablename__ = 'warehouses'
    id = db.Column(db.Integer, primary_key=True)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(255))
    is_active = db.Column(db.Boolean, default=True)

    branch = db.relationship('Branch', foreign_keys=[branch_id])


class Category(db.Model):
    __tablename__ = 'categories'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=True)

    parent = db.relationship('Category', remote_side='[Category.id]', backref='children')


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

    def total_qty(self):
        # Warning: fires one DB query per call — do not use in loops over products.
        # Use inventory_service.get_product_stock with a grouped subquery instead.
        from ..services.inventory_service import get_product_stock
        return get_product_stock(self.id)


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

    product = db.relationship('Product', foreign_keys=[product_id])
    warehouse = db.relationship('Warehouse', foreign_keys=[warehouse_id])


class StockTransfer(db.Model):
    __tablename__ = 'stock_transfers'
    id = db.Column(db.Integer, primary_key=True)
    from_warehouse_id = db.Column(db.Integer, db.ForeignKey('warehouses.id'), nullable=False)
    to_warehouse_id = db.Column(db.Integer, db.ForeignKey('warehouses.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(20), default='PENDING')
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    items = db.relationship('StockTransferItem', backref='transfer',
                            lazy='dynamic', cascade='all, delete-orphan')
    from_warehouse = db.relationship('Warehouse', foreign_keys=[from_warehouse_id],
                                     backref='transfers_out')
    to_warehouse = db.relationship('Warehouse', foreign_keys=[to_warehouse_id],
                                   backref='transfers_in')


class StockTransferItem(db.Model):
    __tablename__ = 'stock_transfer_items'
    id = db.Column(db.Integer, primary_key=True)
    transfer_id = db.Column(db.Integer, db.ForeignKey('stock_transfers.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    batch_id = db.Column(db.Integer, db.ForeignKey('product_batches.id'), nullable=True)
    qty = db.Column(db.Numeric(15, 3), nullable=False)

    product = db.relationship('Product')
    batch = db.relationship('ProductBatch')
