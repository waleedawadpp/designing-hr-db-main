from datetime import datetime
from ..extensions import db


class InvoiceType:
    CASH = 'CASH'
    CREDIT = 'CREDIT'
    ADVANCE = 'ADVANCE'
    LABELS = {'CASH': 'نقدي', 'CREDIT': 'آجل', 'ADVANCE': 'دفعة مقدمة'}


class InvoiceStatus:
    DRAFT = 'DRAFT'
    CONFIRMED = 'CONFIRMED'
    PAID = 'PAID'
    PARTIAL = 'PARTIAL'
    CANCELLED = 'CANCELLED'
    LABELS = {
        'DRAFT': 'مسودة',
        'CONFIRMED': 'مؤكد',
        'PAID': 'مدفوع',
        'PARTIAL': 'مدفوع جزئياً',
        'CANCELLED': 'ملغي',
    }


class Customer(db.Model):
    __tablename__ = 'customers'
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(20), unique=True, nullable=True)
    name = db.Column(db.String(150), nullable=False)
    type = db.Column(db.String(20), default='RETAIL')  # RETAIL / WHOLESALE
    phone = db.Column(db.String(20))
    address = db.Column(db.String(255))
    tax_no = db.Column(db.String(50))
    credit_limit = db.Column(db.Numeric(15, 3), default=0)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=True)
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    invoices = db.relationship('SalesInvoice', backref='customer', lazy='dynamic')

    def outstanding_balance(self):
        from sqlalchemy import func
        result = db.session.query(
            func.coalesce(func.sum(SalesInvoice.grand_total), 0) -
            func.coalesce(func.sum(SalesInvoice.amount_paid), 0)
        ).filter(
            SalesInvoice.customer_id == self.id,
            SalesInvoice.type == InvoiceType.CREDIT,
            SalesInvoice.status.in_([InvoiceStatus.CONFIRMED, InvoiceStatus.PARTIAL])
        ).scalar()
        return float(result or 0)

    def is_over_credit_limit(self):
        if float(self.credit_limit or 0) <= 0:
            return False
        return self.outstanding_balance() > float(self.credit_limit)


class Quotation(db.Model):
    __tablename__ = 'quotations'
    id = db.Column(db.Integer, primary_key=True)
    ref_no = db.Column(db.String(30), unique=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=True)
    date = db.Column(db.Date, nullable=False)
    valid_until = db.Column(db.Date, nullable=True)
    status = db.Column(db.String(20), default='DRAFT')  # DRAFT / SENT / CONVERTED / VOID
    invoice_id = db.Column(db.Integer, db.ForeignKey('sales_invoices.id'), nullable=True)
    notes = db.Column(db.Text)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    items = db.relationship('QuotationItem', backref='quotation',
                             lazy='dynamic', cascade='all, delete-orphan')
    customer = db.relationship('Customer', backref='quotations')


class QuotationItem(db.Model):
    __tablename__ = 'quotation_items'
    id = db.Column(db.Integer, primary_key=True)
    quotation_id = db.Column(db.Integer, db.ForeignKey('quotations.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    qty = db.Column(db.Numeric(15, 3), nullable=False)
    unit_price = db.Column(db.Numeric(15, 3), nullable=False)
    discount_pct = db.Column(db.Numeric(5, 2), default=0)

    product = db.relationship('Product')


class SalesInvoice(db.Model):
    __tablename__ = 'sales_invoices'
    id = db.Column(db.Integer, primary_key=True)
    invoice_no = db.Column(db.String(30), unique=True, nullable=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=False)
    type = db.Column(db.String(10), nullable=False, default=InvoiceType.CASH)
    date = db.Column(db.Date, nullable=False)
    due_date = db.Column(db.Date, nullable=True)
    subtotal = db.Column(db.Numeric(15, 3), default=0)
    discount_total = db.Column(db.Numeric(15, 3), default=0)
    vat_total = db.Column(db.Numeric(15, 3), default=0)
    grand_total = db.Column(db.Numeric(15, 3), default=0)
    amount_paid = db.Column(db.Numeric(15, 3), default=0)
    status = db.Column(db.String(20), default=InvoiceStatus.DRAFT)
    journal_id = db.Column(db.Integer, db.ForeignKey('journal_entries.id'), nullable=True)
    notes = db.Column(db.Text)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    items = db.relationship('InvoiceItem', backref='invoice',
                             lazy='dynamic', cascade='all, delete-orphan')
    returns = db.relationship('SalesReturn', backref='original_invoice', lazy='dynamic')

    def type_label(self):
        return InvoiceType.LABELS.get(self.type, self.type)

    def status_label(self):
        return InvoiceStatus.LABELS.get(self.status, self.status)

    def status_badge_class(self):
        return {
            'DRAFT': 'bg-secondary',
            'CONFIRMED': 'bg-success',
            'PAID': 'bg-primary',
            'PARTIAL': 'bg-warning text-dark',
            'CANCELLED': 'bg-danger',
        }.get(self.status, 'bg-secondary')


class InvoiceItem(db.Model):
    __tablename__ = 'invoice_items'
    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey('sales_invoices.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    batch_id = db.Column(db.Integer, db.ForeignKey('product_batches.id'), nullable=True)
    qty = db.Column(db.Numeric(15, 3), nullable=False)
    unit_price = db.Column(db.Numeric(15, 3), nullable=False)
    discount_pct = db.Column(db.Numeric(5, 2), default=0)
    discount_amt = db.Column(db.Numeric(15, 3), default=0)
    vat_rate = db.Column(db.Numeric(5, 2), default=5)
    vat_amount = db.Column(db.Numeric(15, 3), default=0)
    line_total = db.Column(db.Numeric(15, 3), default=0)

    product = db.relationship('Product')
    batch = db.relationship('ProductBatch')


class SalesReturn(db.Model):
    __tablename__ = 'sales_returns'
    id = db.Column(db.Integer, primary_key=True)
    ref_no = db.Column(db.String(30), unique=True, nullable=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey('sales_invoices.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    reason = db.Column(db.String(500))
    journal_id = db.Column(db.Integer, db.ForeignKey('journal_entries.id'), nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    items = db.relationship('ReturnItem', backref='sales_return',
                             lazy='dynamic', cascade='all, delete-orphan')


class ReturnItem(db.Model):
    __tablename__ = 'return_items'
    id = db.Column(db.Integer, primary_key=True)
    return_id = db.Column(db.Integer, db.ForeignKey('sales_returns.id'), nullable=False)
    invoice_item_id = db.Column(db.Integer, db.ForeignKey('invoice_items.id'), nullable=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    batch_id = db.Column(db.Integer, db.ForeignKey('product_batches.id'), nullable=True)
    qty = db.Column(db.Numeric(15, 3), nullable=False)
