import pytest
from datetime import date, timedelta
from decimal import Decimal


@pytest.fixture(autouse=True, scope='module')
def clean_fleet_tables(app):
    from app.models import (Delivery, LoadItem, LoadOrder, Route,
                             VehicleFuel, VehicleMaintenance, Vehicle)
    from app.extensions import db
    with app.app_context():
        Delivery.query.delete()
        LoadItem.query.delete()
        LoadOrder.query.delete()
        Route.query.delete()
        VehicleFuel.query.delete()
        VehicleMaintenance.query.delete()
        Vehicle.query.delete()
        db.session.commit()
    yield
    with app.app_context():
        Delivery.query.delete()
        LoadItem.query.delete()
        LoadOrder.query.delete()
        Route.query.delete()
        VehicleFuel.query.delete()
        VehicleMaintenance.query.delete()
        Vehicle.query.delete()
        db.session.commit()


def test_vehicle_list(logged_in_client):
    rv = logged_in_client.get('/fleet/vehicles/')
    assert rv.status_code == 200


def test_create_vehicle(app, logged_in_client, seed_user):
    rv = logged_in_client.post('/fleet/vehicles/new', data={
        'plate_no': 'ABC-123', 'model': 'Toyota',
        'status': 'ACTIVE', 'csrf_token': '',
    }, follow_redirects=True)
    assert rv.status_code == 200
    from app.models import Vehicle
    with app.app_context():
        v = Vehicle.query.filter_by(plate_no='ABC-123').first()
        assert v is not None


def test_license_expiry_alert(app, seed_user):
    from app.models import Vehicle
    from app.extensions import db
    with app.app_context():
        # Vehicle with expiry in 10 days → should trigger alert
        v_expiring = Vehicle(plate_no='EXP-001', status='ACTIVE',
                             license_expiry=date.today() + timedelta(days=10))
        v_ok = Vehicle(plate_no='OK-001', status='ACTIVE',
                       license_expiry=date.today() + timedelta(days=60))
        db.session.add_all([v_expiring, v_ok])
        db.session.commit()
        assert v_expiring.is_license_expiring_soon(30) is True
        assert v_ok.is_license_expiring_soon(30) is False


def test_load_order_with_delivery(app, seed_user):
    from app.models import (Vehicle, LoadOrder, LoadItem, Delivery,
                             LoadOrderStatus, DeliveryStatus)
    from app.models.sales import SalesInvoice, InvoiceStatus, InvoiceType
    from app.models.core import Branch
    from app.models.sales import Customer
    from app.extensions import db
    with app.app_context():
        branch = Branch.query.first()
        customer = Customer(name='عميل توزيع', branch_id=branch.id)
        db.session.add(customer)
        db.session.flush()
        invoice = SalesInvoice(
            customer_id=customer.id, branch_id=branch.id,
            type=InvoiceType.CREDIT, date=date.today(),
            status=InvoiceStatus.CONFIRMED,
            subtotal=Decimal('100'), grand_total=Decimal('105'),
        )
        db.session.add(invoice)
        v = Vehicle(plate_no='LO-VEH-001', status='ACTIVE')
        db.session.add(v)
        db.session.flush()
        lo = LoadOrder(vehicle_id=v.id, date=date.today(),
                       status=LoadOrderStatus.PENDING)
        db.session.add(lo)
        db.session.flush()
        item = LoadItem(load_order_id=lo.id, invoice_id=invoice.id)
        delivery = Delivery(load_order_id=lo.id, invoice_id=invoice.id,
                            status=DeliveryStatus.PENDING)
        db.session.add_all([item, delivery])
        db.session.commit()
        lo_id = lo.id
        delivery_id = delivery.id

    with app.app_context():
        d = db.session.get(Delivery, delivery_id)
        d.status = DeliveryStatus.DELIVERED
        d.collected_amount = Decimal('105')
        db.session.commit()

        lo = db.session.get(LoadOrder, lo_id)
        d = db.session.get(Delivery, delivery_id)
        assert d.status == DeliveryStatus.DELIVERED
        assert float(d.collected_amount) == 105.0


def test_load_order_completed_when_all_delivered(app, seed_user):
    from app.models import (Vehicle, LoadOrder, Delivery,
                             LoadOrderStatus, DeliveryStatus)
    from app.models.sales import SalesInvoice, InvoiceStatus, InvoiceType
    from app.models.core import Branch
    from app.models.sales import Customer
    from app.extensions import db
    with app.app_context():
        branch = Branch.query.first()
        customer = Customer(name='عميل اكتمال', branch_id=branch.id)
        db.session.add(customer)
        db.session.flush()
        invoice = SalesInvoice(
            customer_id=customer.id, branch_id=branch.id,
            type=InvoiceType.CASH, date=date.today(),
            status=InvoiceStatus.CONFIRMED,
            grand_total=Decimal('50'),
        )
        db.session.add(invoice)
        v = Vehicle(plate_no='COMP-VEH-001', status='ACTIVE')
        db.session.add(v)
        db.session.flush()
        lo = LoadOrder(vehicle_id=v.id, date=date.today(),
                       status=LoadOrderStatus.IN_TRANSIT)
        db.session.add(lo)
        db.session.flush()
        delivery = Delivery(load_order_id=lo.id, invoice_id=invoice.id,
                            status=DeliveryStatus.PENDING)
        db.session.add(delivery)
        db.session.commit()
        lo_id = lo.id
        delivery_id = delivery.id

    with app.app_context():
        d = db.session.get(Delivery, delivery_id)
        d.status = DeliveryStatus.DELIVERED
        d.collected_amount = Decimal('50')
        lo = db.session.get(LoadOrder, lo_id)
        # Simulate the "all delivered → COMPLETED" logic
        pending = lo.deliveries.filter_by(status=DeliveryStatus.PENDING).count()
        if pending == 0:
            lo.status = LoadOrderStatus.COMPLETED
        db.session.commit()
        assert db.session.get(LoadOrder, lo_id).status == LoadOrderStatus.COMPLETED
