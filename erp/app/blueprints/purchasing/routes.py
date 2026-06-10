import logging
from datetime import date as date_type
from decimal import Decimal

from flask import render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_required, current_user

from . import purchasing_bp
from .forms import SupplierForm, PurchaseOrderForm, ImportCostForm, GoodsReceiptForm
from ...models import (Supplier, PurchaseOrder, POItem, ImportCost,
                       GoodsReceipt, GRItem, POStatus, Product, Warehouse)
from ...extensions import db
from ...services.purchasing_service import confirm_goods_receipt, calculate_po_total

logger = logging.getLogger(__name__)

# ── Suppliers ─────────────────────────────────────────────────────────────────

@purchasing_bp.route('/suppliers/')
@login_required
def suppliers():
    s = Supplier.query.order_by(Supplier.name).all()
    return render_template('purchasing/suppliers/index.html', suppliers=s)


@purchasing_bp.route('/suppliers/new', methods=['GET', 'POST'])
@login_required
def new_supplier():
    form = SupplierForm()
    if form.validate_on_submit():
        supplier = Supplier(
            name=form.name.data, country=form.country.data,
            contact=form.contact.data, email=form.email.data,
            phone=form.phone.data,
            payment_terms=form.payment_terms.data or 30,
        )
        db.session.add(supplier)
        db.session.commit()
        flash('تم إضافة المورد', 'success')
        return redirect(url_for('purchasing.suppliers'))
    return render_template('purchasing/suppliers/form.html', form=form, title='إضافة مورد')


@purchasing_bp.route('/suppliers/<int:id>/edit', methods=['GET', 'POST'])
@login_required
def edit_supplier(id):
    supplier = db.session.get(Supplier, id)
    if not supplier:
        flash('المورد غير موجود', 'danger')
        return redirect(url_for('purchasing.suppliers'))
    form = SupplierForm(obj=supplier)
    if form.validate_on_submit():
        supplier.name = form.name.data
        supplier.country = form.country.data
        supplier.contact = form.contact.data
        supplier.email = form.email.data
        supplier.phone = form.phone.data
        supplier.payment_terms = form.payment_terms.data or 30
        db.session.commit()
        flash('تم تحديث المورد', 'success')
        return redirect(url_for('purchasing.suppliers'))
    return render_template('purchasing/suppliers/form.html', form=form, title='تعديل مورد')


# ── Purchase Orders ──────────────────────────────────────────────────────────

@purchasing_bp.route('/orders/')
@login_required
def orders():
    from sqlalchemy.orm import joinedload
    pos = (PurchaseOrder.query
           .options(joinedload(PurchaseOrder.supplier))
           .order_by(PurchaseOrder.date.desc())
           .all())
    return render_template('purchasing/orders/index.html', orders=pos)


@purchasing_bp.route('/orders/new', methods=['GET', 'POST'])
@login_required
def new_order():
    from ...models.core import Branch
    form = PurchaseOrderForm()
    form.supplier_id.choices = [(s.id, s.name) for s in Supplier.query.filter_by(is_active=True).order_by(Supplier.name).all()]
    form.branch_id.choices = [(0, '— اختر فرعاً —')] + [(b.id, b.name) for b in Branch.query.filter_by(is_active=True).all()]
    products = Product.query.filter_by(is_active=True).order_by(Product.name_ar).all()
    if form.validate_on_submit():
        po = PurchaseOrder(
            supplier_id=form.supplier_id.data,
            branch_id=form.branch_id.data or None,
            date=form.date.data,
            expected_date=form.expected_date.data,
            currency=form.currency.data,
            exchange_rate=form.exchange_rate.data or 1,
            notes=form.notes.data,
            status=POStatus.DRAFT,
            created_by=current_user.id,
        )
        db.session.add(po)
        db.session.flush()

        # Parse line items
        product_ids = request.form.getlist('product_id[]')
        qtys = request.form.getlist('qty[]')
        unit_prices = request.form.getlist('unit_price[]')
        for pid, qty_str, price_str in zip(product_ids, qtys, unit_prices):
            try:
                qty = float(qty_str)
                price = float(price_str)
                if qty > 0 and price >= 0:
                    item = POItem(
                        po_id=po.id, product_id=int(pid),
                        qty=Decimal(str(qty)), unit_price=Decimal(str(price)),
                        total_price=Decimal(str(round(qty * price, 3))),
                    )
                    db.session.add(item)
            except (ValueError, TypeError):
                pass

        calculate_po_total(po)
        db.session.commit()
        flash('تم إنشاء أمر الشراء', 'success')
        return redirect(url_for('purchasing.order_detail', id=po.id))
    return render_template('purchasing/orders/form.html', form=form, products=products, title='أمر شراء جديد')


@purchasing_bp.route('/orders/<int:id>')
@login_required
def order_detail(id):
    po = db.session.get(PurchaseOrder, id)
    if not po:
        flash('أمر الشراء غير موجود', 'danger')
        return redirect(url_for('purchasing.orders'))
    import_cost_form = ImportCostForm()
    receipt_form = GoodsReceiptForm()
    receipt_form.warehouse_id.choices = [(w.id, w.name) for w in Warehouse.query.order_by(Warehouse.name).all()]
    return render_template('purchasing/orders/detail.html',
                           po=po, import_cost_form=import_cost_form,
                           receipt_form=receipt_form)


@purchasing_bp.route('/orders/<int:id>/approve', methods=['POST'])
@login_required
def approve_order(id):
    po = db.session.get(PurchaseOrder, id)
    if po and po.status == POStatus.DRAFT:
        po.status = POStatus.APPROVED
        db.session.commit()
        flash('تم اعتماد أمر الشراء', 'success')
    return redirect(url_for('purchasing.order_detail', id=id))


@purchasing_bp.route('/orders/<int:id>/cancel', methods=['POST'])
@login_required
def cancel_order(id):
    po = db.session.get(PurchaseOrder, id)
    if po and po.status in (POStatus.DRAFT, POStatus.APPROVED):
        po.status = POStatus.CANCELLED
        db.session.commit()
        flash('تم إلغاء أمر الشراء', 'danger')
    return redirect(url_for('purchasing.order_detail', id=id))


# ── Import Costs ─────────────────────────────────────────────────────────────

@purchasing_bp.route('/orders/<int:po_id>/costs/add', methods=['POST'])
@login_required
def add_import_cost(po_id):
    po = db.session.get(PurchaseOrder, po_id)
    if not po:
        flash('أمر الشراء غير موجود', 'danger')
        return redirect(url_for('purchasing.orders'))
    form = ImportCostForm()
    if form.validate_on_submit():
        cost = ImportCost(
            po_id=po_id, cost_type=form.cost_type.data,
            amount=form.amount.data, currency=form.currency.data,
            notes=form.notes.data,
        )
        db.session.add(cost)
        db.session.commit()
        flash('تم إضافة تكلفة الاستيراد', 'success')
    return redirect(url_for('purchasing.order_detail', id=po_id))


# ── Goods Receipt ────────────────────────────────────────────────────────────

@purchasing_bp.route('/orders/<int:po_id>/receipt/new', methods=['GET', 'POST'])
@login_required
def new_receipt(po_id):
    po = db.session.get(PurchaseOrder, po_id)
    if not po or po.status not in (POStatus.APPROVED,):
        flash('لا يمكن إنشاء استلام لهذا الأمر', 'danger')
        return redirect(url_for('purchasing.order_detail', id=po_id))
    form = GoodsReceiptForm()
    form.warehouse_id.choices = [(w.id, w.name) for w in Warehouse.query.order_by(Warehouse.name).all()]
    if form.validate_on_submit():
        receipt = GoodsReceipt(
            po_id=po_id, warehouse_id=form.warehouse_id.data,
            date=form.date.data, created_by=current_user.id,
        )
        db.session.add(receipt)
        db.session.flush()

        # Parse GR items from form
        product_ids = request.form.getlist('product_id[]')
        qtys = request.form.getlist('qty_received[]')
        batch_nos = request.form.getlist('batch_no[]')
        unit_costs = request.form.getlist('unit_cost[]')
        expiry_dates = request.form.getlist('expiry_date[]')
        for i, (pid, qty_str) in enumerate(zip(product_ids, qtys)):
            try:
                qty = float(qty_str)
                if qty > 0:
                    from datetime import date
                    exp = None
                    if i < len(expiry_dates) and expiry_dates[i]:
                        try:
                            exp = date.fromisoformat(expiry_dates[i])
                        except ValueError:
                            pass
                    unit_cost = 0
                    if i < len(unit_costs) and unit_costs[i]:
                        try:
                            unit_cost = float(unit_costs[i])
                        except ValueError:
                            pass
                    gr_item = GRItem(
                        receipt_id=receipt.id,
                        product_id=int(pid),
                        qty_received=Decimal(str(qty)),
                        batch_no=batch_nos[i] if i < len(batch_nos) else None,
                        unit_cost=Decimal(str(unit_cost)),
                        expiry_date=exp,
                    )
                    db.session.add(gr_item)
            except (ValueError, TypeError):
                pass

        db.session.commit()
        flash('تم إنشاء الاستلام، يمكنك الآن تأكيده', 'info')
        return redirect(url_for('purchasing.order_detail', id=po_id))
    return render_template('purchasing/receipt/form.html', form=form, po=po)


@purchasing_bp.route('/orders/<int:po_id>/receipt/<int:receipt_id>/confirm', methods=['POST'])
@login_required
def confirm_receipt(po_id, receipt_id):
    try:
        confirm_goods_receipt(receipt_id, created_by=current_user.id)
        flash('تم تأكيد الاستلام وتحديث المخزون', 'success')
    except Exception as e:
        flash(str(e) or 'حدث خطأ أثناء تأكيد الاستلام', 'danger')
    return redirect(url_for('purchasing.order_detail', id=po_id))
