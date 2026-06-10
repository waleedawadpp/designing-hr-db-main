import datetime
from ..extensions import db


class SupplierStatus:
    ACTIVE = 'ACTIVE'
    INACTIVE = 'INACTIVE'


class POStatus:
    DRAFT = 'DRAFT'
    APPROVED = 'APPROVED'
    RECEIVED = 'RECEIVED'
    CANCELLED = 'CANCELLED'
    LABELS = {
        'DRAFT': 'مسودة',
        'APPROVED': 'معتمد',
        'RECEIVED': 'مستلم',
        'CANCELLED': 'ملغي',
    }


class Supplier(db.Model):
    __tablename__ = 'suppliers'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    country = db.Column(db.String(80))
    contact = db.Column(db.String(100))
    email = db.Column(db.String(120))
    phone = db.Column(db.String(30))
    payment_terms = db.Column(db.Integer, default=30)  # days
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    account = db.relationship('Account', backref='suppliers')


class PurchaseOrder(db.Model):
    __tablename__ = 'purchase_orders'
    id = db.Column(db.Integer, primary_key=True)
    ref_no = db.Column(db.String(30), unique=True, nullable=True)
    supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=False)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=True)
    date = db.Column(db.Date, nullable=False)
    expected_date = db.Column(db.Date, nullable=True)
    status = db.Column(db.String(20), default=POStatus.DRAFT)
    currency = db.Column(db.String(10), default='SAR')
    exchange_rate = db.Column(db.Numeric(10, 4), default=1)
    total_amount = db.Column(db.Numeric(15, 3), default=0)
    notes = db.Column(db.Text)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    supplier = db.relationship('Supplier', backref='purchase_orders')
    branch = db.relationship('Branch', backref='purchase_orders')
    items = db.relationship('POItem', backref='po', lazy='dynamic',
                             cascade='all, delete-orphan')
    import_costs = db.relationship('ImportCost', backref='po', lazy='dynamic',
                                    cascade='all, delete-orphan')
    receipts = db.relationship('GoodsReceipt', backref='po', lazy='dynamic')

    def status_label(self):
        return POStatus.LABELS.get(self.status, self.status)

    def status_badge_class(self):
        return {
            'DRAFT': 'bg-secondary',
            'APPROVED': 'bg-primary',
            'RECEIVED': 'bg-success',
            'CANCELLED': 'bg-danger',
        }.get(self.status, 'bg-secondary')


class POItem(db.Model):
    __tablename__ = 'po_items'
    id = db.Column(db.Integer, primary_key=True)
    po_id = db.Column(db.Integer, db.ForeignKey('purchase_orders.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    qty = db.Column(db.Numeric(15, 3), nullable=False)
    unit_price = db.Column(db.Numeric(15, 3), nullable=False)
    total_price = db.Column(db.Numeric(15, 3), default=0)

    product = db.relationship('Product')


class ImportCost(db.Model):
    """Additional costs on a PO: shipping, customs, clearance, etc."""
    __tablename__ = 'import_costs'
    id = db.Column(db.Integer, primary_key=True)
    po_id = db.Column(db.Integer, db.ForeignKey('purchase_orders.id'), nullable=False)
    cost_type = db.Column(db.String(30), nullable=False)  # SHIPPING/CUSTOMS/CLEARANCE/OTHER
    amount = db.Column(db.Numeric(15, 3), nullable=False)
    currency = db.Column(db.String(10), default='SAR')
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)
    notes = db.Column(db.String(255))

    account = db.relationship('Account')


class GoodsReceipt(db.Model):
    __tablename__ = 'goods_receipts'
    id = db.Column(db.Integer, primary_key=True)
    po_id = db.Column(db.Integer, db.ForeignKey('purchase_orders.id'), nullable=False)
    warehouse_id = db.Column(db.Integer, db.ForeignKey('warehouses.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    journal_id = db.Column(db.Integer, db.ForeignKey('journal_entries.id'), nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    warehouse = db.relationship('Warehouse', backref='goods_receipts')
    items = db.relationship('GRItem', backref='receipt', lazy='dynamic',
                             cascade='all, delete-orphan')


class GRItem(db.Model):
    __tablename__ = 'gr_items'
    id = db.Column(db.Integer, primary_key=True)
    receipt_id = db.Column(db.Integer, db.ForeignKey('goods_receipts.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    po_item_id = db.Column(db.Integer, db.ForeignKey('po_items.id'), nullable=True)
    batch_id = db.Column(db.Integer, db.ForeignKey('product_batches.id'), nullable=True)
    qty_received = db.Column(db.Numeric(15, 3), nullable=False)
    batch_no = db.Column(db.String(50))
    expiry_date = db.Column(db.Date, nullable=True)
    unit_cost = db.Column(db.Numeric(15, 3), default=0)
    landed_cost = db.Column(db.Numeric(15, 3), default=0)

    product = db.relationship('Product')
    batch = db.relationship('ProductBatch')
