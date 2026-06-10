import datetime
from ..extensions import db


class VehicleStatus:
    ACTIVE = 'ACTIVE'
    MAINTENANCE = 'MAINTENANCE'
    INACTIVE = 'INACTIVE'
    LABELS = {'ACTIVE': 'نشط', 'MAINTENANCE': 'صيانة', 'INACTIVE': 'غير نشط'}


class LoadOrderStatus:
    PENDING = 'PENDING'
    LOADED = 'LOADED'
    IN_TRANSIT = 'IN_TRANSIT'
    COMPLETED = 'COMPLETED'
    LABELS = {
        'PENDING': 'معلق', 'LOADED': 'محمّل',
        'IN_TRANSIT': 'في الطريق', 'COMPLETED': 'مكتمل'
    }


class DeliveryStatus:
    PENDING = 'PENDING'
    DELIVERED = 'DELIVERED'
    RETURNED = 'RETURNED'
    LABELS = {'PENDING': 'معلق', 'DELIVERED': 'تم التسليم', 'RETURNED': 'مُعاد'}


class Vehicle(db.Model):
    __tablename__ = 'vehicles'
    id = db.Column(db.Integer, primary_key=True)
    plate_no = db.Column(db.String(20), unique=True, nullable=False)
    model = db.Column(db.String(100))
    year = db.Column(db.Integer)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=True)
    driver_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    license_expiry = db.Column(db.Date, nullable=True)
    status = db.Column(db.String(20), default=VehicleStatus.ACTIVE)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    branch = db.relationship('Branch', backref='vehicles')
    driver = db.relationship('User', backref='vehicle', foreign_keys=[driver_id])
    maintenance_records = db.relationship('VehicleMaintenance', backref='vehicle',
                                           lazy='dynamic')
    fuel_records = db.relationship('VehicleFuel', backref='vehicle', lazy='dynamic')

    def is_license_expiring_soon(self, days=30):
        if not self.license_expiry:
            return False
        from datetime import date
        return (self.license_expiry - date.today()).days <= days

    def status_label(self):
        return VehicleStatus.LABELS.get(self.status, self.status)


class VehicleMaintenance(db.Model):
    __tablename__ = 'vehicle_maintenance'
    id = db.Column(db.Integer, primary_key=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey('vehicles.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    type = db.Column(db.String(50))  # OIL_CHANGE / TIRES / GENERAL / etc.
    description = db.Column(db.String(500))
    cost = db.Column(db.Numeric(15, 3), default=0)
    next_due_date = db.Column(db.Date, nullable=True)
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)


class VehicleFuel(db.Model):
    __tablename__ = 'vehicle_fuel'
    id = db.Column(db.Integer, primary_key=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey('vehicles.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    liters = db.Column(db.Numeric(10, 3), nullable=False)
    cost = db.Column(db.Numeric(15, 3), nullable=False)
    odometer_km = db.Column(db.Integer)


class Route(db.Model):
    __tablename__ = 'routes'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=True)
    stops = db.Column(db.Text)  # JSON list of stop names/addresses

    branch = db.relationship('Branch', backref='routes')

    def get_stops(self):
        import json
        try:
            return json.loads(self.stops or '[]')
        except (json.JSONDecodeError, TypeError):
            return []


class LoadOrder(db.Model):
    __tablename__ = 'load_orders'
    id = db.Column(db.Integer, primary_key=True)
    ref_no = db.Column(db.String(30), unique=True, nullable=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey('vehicles.id'), nullable=False)
    driver_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    route_id = db.Column(db.Integer, db.ForeignKey('routes.id'), nullable=True)
    date = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(20), default=LoadOrderStatus.PENDING)
    notes = db.Column(db.Text)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    vehicle = db.relationship('Vehicle', backref='load_orders')
    driver = db.relationship('User', foreign_keys=[driver_id], backref='load_orders_driven')
    route = db.relationship('Route', backref='load_orders')
    items = db.relationship('LoadItem', backref='load_order',
                             lazy='dynamic', cascade='all, delete-orphan')
    deliveries = db.relationship('Delivery', backref='load_order', lazy='dynamic')

    def status_label(self):
        return LoadOrderStatus.LABELS.get(self.status, self.status)


class LoadItem(db.Model):
    __tablename__ = 'load_items'
    id = db.Column(db.Integer, primary_key=True)
    load_order_id = db.Column(db.Integer, db.ForeignKey('load_orders.id'), nullable=False)
    invoice_id = db.Column(db.Integer, db.ForeignKey('sales_invoices.id'), nullable=False)
    qty_loaded = db.Column(db.Numeric(15, 3), default=0)

    invoice = db.relationship('SalesInvoice')


class Delivery(db.Model):
    __tablename__ = 'deliveries'
    id = db.Column(db.Integer, primary_key=True)
    load_order_id = db.Column(db.Integer, db.ForeignKey('load_orders.id'), nullable=False)
    invoice_id = db.Column(db.Integer, db.ForeignKey('sales_invoices.id'), nullable=False)
    status = db.Column(db.String(20), default=DeliveryStatus.PENDING)
    collected_amount = db.Column(db.Numeric(15, 3), default=0)
    notes = db.Column(db.String(500))
    delivered_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    invoice = db.relationship('SalesInvoice')

    def status_label(self):
        return DeliveryStatus.LABELS.get(self.status, self.status)
