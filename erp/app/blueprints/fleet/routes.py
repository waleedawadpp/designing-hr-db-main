import logging
from datetime import date as date_type
from decimal import Decimal

from flask import render_template, redirect, url_for, flash, request
from flask_login import login_required, current_user
from sqlalchemy.orm import joinedload

from . import fleet_bp
from .forms import VehicleForm, MaintenanceForm, FuelForm, RouteForm, LoadOrderForm
from ...models import (Vehicle, VehicleMaintenance, VehicleFuel, Route,
                       LoadOrder, LoadItem, Delivery,
                       VehicleStatus, LoadOrderStatus, DeliveryStatus)
from ...extensions import db

logger = logging.getLogger(__name__)


# ── Vehicles ──────────────────────────────────────────────────────────────────

@fleet_bp.route('/vehicles/')
@login_required
def vehicles():
    vs = Vehicle.query.options(joinedload(Vehicle.driver)).order_by(Vehicle.plate_no).all()
    # Flag vehicles with license expiring within 30 days
    alerts = [v for v in vs if v.is_license_expiring_soon(30)]
    return render_template('fleet/vehicles/index.html', vehicles=vs, alerts=alerts)


@fleet_bp.route('/vehicles/new', methods=['GET', 'POST'])
@login_required
def new_vehicle():
    from ...models.core import Branch, User, UserRole
    form = VehicleForm()
    form.branch_id.choices = [(0, '— اختر —')] + [(b.id, b.name) for b in Branch.query.filter_by(is_active=True).all()]
    form.driver_id.choices = [(0, '— اختر سائقاً —')] + [
        (u.id, u.full_name) for u in User.query.filter_by(role=UserRole.DRIVER, is_active=True).all()
    ]
    if form.validate_on_submit():
        v = Vehicle(
            plate_no=form.plate_no.data,
            model=form.model.data,
            year=form.year.data,
            branch_id=form.branch_id.data or None,
            driver_id=form.driver_id.data or None,
            license_expiry=form.license_expiry.data,
            status=form.status.data,
        )
        db.session.add(v)
        db.session.commit()
        flash('تم إضافة المركبة', 'success')
        return redirect(url_for('fleet.vehicles'))
    return render_template('fleet/vehicles/form.html', form=form, title='إضافة مركبة')


@fleet_bp.route('/vehicles/<int:id>/edit', methods=['GET', 'POST'])
@login_required
def edit_vehicle(id):
    from ...models.core import Branch, User, UserRole
    v = db.session.get(Vehicle, id)
    if not v:
        flash('المركبة غير موجودة', 'danger')
        return redirect(url_for('fleet.vehicles'))
    form = VehicleForm(obj=v)
    form.branch_id.choices = [(0, '— اختر —')] + [(b.id, b.name) for b in Branch.query.filter_by(is_active=True).all()]
    form.driver_id.choices = [(0, '— اختر —')] + [
        (u.id, u.full_name) for u in User.query.filter_by(role=UserRole.DRIVER, is_active=True).all()
    ]
    if form.validate_on_submit():
        v.plate_no = form.plate_no.data
        v.model = form.model.data
        v.year = form.year.data
        v.branch_id = form.branch_id.data or None
        v.driver_id = form.driver_id.data or None
        v.license_expiry = form.license_expiry.data
        v.status = form.status.data
        db.session.commit()
        flash('تم تحديث المركبة', 'success')
        return redirect(url_for('fleet.vehicles'))
    return render_template('fleet/vehicles/form.html', form=form, title='تعديل مركبة')


@fleet_bp.route('/vehicles/<int:id>')
@login_required
def vehicle_detail(id):
    v = db.session.get(Vehicle, id)
    if not v:
        flash('المركبة غير موجودة', 'danger')
        return redirect(url_for('fleet.vehicles'))
    maint_form = MaintenanceForm()
    fuel_form = FuelForm()
    recent_maint = v.maintenance_records.order_by(VehicleMaintenance.date.desc()).limit(10).all()
    recent_fuel = v.fuel_records.order_by(VehicleFuel.date.desc()).limit(10).all()
    return render_template('fleet/vehicles/detail.html',
                           v=v, maint_form=maint_form, fuel_form=fuel_form,
                           recent_maint=recent_maint, recent_fuel=recent_fuel)


@fleet_bp.route('/vehicles/<int:vehicle_id>/maintenance/add', methods=['POST'])
@login_required
def add_maintenance(vehicle_id):
    v = db.session.get(Vehicle, vehicle_id)
    if not v:
        return redirect(url_for('fleet.vehicles'))
    form = MaintenanceForm()
    if form.validate_on_submit():
        maint = VehicleMaintenance(
            vehicle_id=vehicle_id,
            date=form.date.data, type=form.type.data,
            description=form.description.data,
            cost=form.cost.data or 0,
            next_due_date=form.next_due_date.data,
        )
        db.session.add(maint)
        db.session.commit()
        flash('تم تسجيل الصيانة', 'success')
    return redirect(url_for('fleet.vehicle_detail', id=vehicle_id))


@fleet_bp.route('/vehicles/<int:vehicle_id>/fuel/add', methods=['POST'])
@login_required
def add_fuel(vehicle_id):
    v = db.session.get(Vehicle, vehicle_id)
    if not v:
        flash('المركبة غير موجودة', 'danger')
        return redirect(url_for('fleet.vehicles'))
    form = FuelForm()
    if form.validate_on_submit():
        fuel = VehicleFuel(
            vehicle_id=vehicle_id,
            date=form.date.data,
            liters=form.liters.data,
            cost=form.cost.data,
            odometer_km=form.odometer_km.data,
        )
        db.session.add(fuel)
        db.session.commit()
        flash('تم تسجيل الوقود', 'success')
    return redirect(url_for('fleet.vehicle_detail', id=vehicle_id))


# ── Routes ────────────────────────────────────────────────────────────────────

@fleet_bp.route('/routes/')
@login_required
def route_list():
    routes = Route.query.order_by(Route.name).all()
    return render_template('fleet/routes/index.html', routes=routes)


@fleet_bp.route('/routes/new', methods=['GET', 'POST'])
@login_required
def new_route():
    from ...models.core import Branch
    form = RouteForm()
    form.branch_id.choices = [(0, '— اختر —')] + [(b.id, b.name) for b in Branch.query.filter_by(is_active=True).all()]
    if form.validate_on_submit():
        route = Route(name=form.name.data, branch_id=form.branch_id.data or None)
        db.session.add(route)
        db.session.commit()
        flash('تم إضافة المسار', 'success')
        return redirect(url_for('fleet.route_list'))
    return render_template('fleet/routes/form.html', form=form, title='إضافة مسار')


# ── Load Orders ───────────────────────────────────────────────────────────────

@fleet_bp.route('/load-orders/')
@login_required
def load_orders():
    orders = (LoadOrder.query
              .options(joinedload(LoadOrder.vehicle), joinedload(LoadOrder.driver))
              .order_by(LoadOrder.date.desc())
              .all())
    return render_template('fleet/load_orders/index.html', orders=orders)


@fleet_bp.route('/load-orders/new', methods=['GET', 'POST'])
@login_required
def new_load_order():
    from ...models.core import User, UserRole
    from ...models.sales import SalesInvoice, InvoiceStatus
    form = LoadOrderForm()
    form.vehicle_id.choices = [(v.id, f'{v.plate_no} — {v.model or ""}')
                                for v in Vehicle.query.filter_by(status=VehicleStatus.ACTIVE).all()]
    form.driver_id.choices = [(0, '— اختر سائقاً —')] + [
        (u.id, u.full_name) for u in User.query.filter_by(role=UserRole.DRIVER, is_active=True).all()
    ]
    form.route_id.choices = [(0, '— اختر مساراً —')] + [(r.id, r.name) for r in Route.query.all()]
    invoices = SalesInvoice.query.filter_by(status=InvoiceStatus.CONFIRMED).order_by(SalesInvoice.date.desc()).limit(100).all()
    if form.validate_on_submit():
        try:
            lo = LoadOrder(
                vehicle_id=form.vehicle_id.data,
                driver_id=form.driver_id.data or None,
                route_id=form.route_id.data or None,
                date=form.date.data,
                notes=form.notes.data,
                status=LoadOrderStatus.PENDING,
                created_by=current_user.id,
            )
            db.session.add(lo)
            db.session.flush()
            lo.ref_no = f'LO-{date_type.today().year}-{lo.id:05d}'
            invoice_ids = request.form.getlist('invoice_id[]')
            for inv_id_str in invoice_ids:
                try:
                    inv_id = int(inv_id_str)
                    item = LoadItem(load_order_id=lo.id, invoice_id=inv_id)
                    db.session.add(item)
                    delivery = Delivery(
                        load_order_id=lo.id,
                        invoice_id=inv_id,
                        status=DeliveryStatus.PENDING,
                    )
                    db.session.add(delivery)
                except (ValueError, TypeError):
                    logger.warning('Invalid invoice_id: %s', inv_id_str)
            db.session.commit()
            flash('تم إنشاء أمر التحميل', 'success')
            return redirect(url_for('fleet.load_order_detail', id=lo.id))
        except Exception:
            db.session.rollback()
            logger.exception('Failed to create load order')
            flash('حدث خطأ أثناء إنشاء أمر التحميل', 'danger')
    return render_template('fleet/load_orders/form.html', form=form, invoices=invoices)


@fleet_bp.route('/load-orders/<int:id>')
@login_required
def load_order_detail(id):
    lo = db.session.get(LoadOrder, id)
    if not lo:
        flash('أمر التحميل غير موجود', 'danger')
        return redirect(url_for('fleet.load_orders'))
    deliveries = lo.deliveries.all()
    return render_template('fleet/load_orders/detail.html', lo=lo, deliveries=deliveries)


@fleet_bp.route('/load-orders/<int:id>/dispatch', methods=['POST'])
@login_required
def dispatch_load_order(id):
    lo = db.session.get(LoadOrder, id)
    if lo and lo.status == LoadOrderStatus.PENDING:
        lo.status = LoadOrderStatus.IN_TRANSIT
        db.session.commit()
        flash('تم إرسال المركبة', 'success')
    return redirect(url_for('fleet.load_order_detail', id=id))


# ── Deliveries ────────────────────────────────────────────────────────────────

@fleet_bp.route('/deliveries/<int:id>/complete', methods=['POST'])
@login_required
def complete_delivery(id):
    import datetime as dt
    delivery = db.session.get(Delivery, id)
    if not delivery or delivery.status != DeliveryStatus.PENDING:
        flash('لا يمكن تحديث هذا التسليم', 'danger')
        return redirect(url_for('fleet.load_orders'))
    collected = request.form.get('collected_amount', '0')
    try:
        delivery.collected_amount = Decimal(collected)
    except (ValueError, TypeError):
        delivery.collected_amount = Decimal('0')
    delivery.status = DeliveryStatus.DELIVERED
    delivery.delivered_at = dt.datetime.utcnow()
    delivery.notes = request.form.get('notes', '')
    # Check if all deliveries for this load order are done
    lo = delivery.load_order
    pending = lo.deliveries.filter_by(status=DeliveryStatus.PENDING).count()
    if pending == 0:
        lo.status = LoadOrderStatus.COMPLETED
    db.session.commit()
    flash('تم تسجيل التسليم', 'success')
    return redirect(url_for('fleet.load_order_detail', id=lo.id))


@fleet_bp.route('/deliveries/<int:id>/return', methods=['POST'])
@login_required
def return_delivery(id):
    delivery = db.session.get(Delivery, id)
    if not delivery:
        flash('التسليم غير موجود', 'danger')
        return redirect(url_for('fleet.load_orders'))
    if delivery.status == DeliveryStatus.PENDING:
        delivery.status = DeliveryStatus.RETURNED
        delivery.notes = request.form.get('notes', '')
        db.session.commit()
        flash('تم تسجيل الإعادة', 'info')
    return redirect(url_for('fleet.load_order_detail', id=delivery.load_order_id))
