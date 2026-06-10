import logging
from datetime import date as date_type
from decimal import Decimal
from flask import render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_required, current_user
from . import inventory_bp
from .forms import CategoryForm, ProductForm, WarehouseForm, StockMovementForm, StockTransferForm
from ...models import (Product, Category, Warehouse, ProductBatch,
                       StockMovement, StockTransfer, StockTransferItem)
from ...extensions import db
from ...services.inventory_service import deduct_stock, get_product_stock

logger = logging.getLogger(__name__)


@inventory_bp.route('/products')
@login_required
def products():
    """List page."""
    items = Product.query.order_by(Product.name_ar).all()
    return render_template('inventory/products/index.html', products=items)


@inventory_bp.route('/api/products')
@login_required
def api_products():
    """JSON endpoint for invoice form product search."""
    q = request.args.get('q', '').strip()
    query = Product.query.filter_by(is_active=True)
    if q:
        query = query.filter(
            Product.name_ar.ilike(f'%{q}%') |
            Product.code.ilike(f'%{q}%') |
            Product.barcode.ilike(f'%{q}%')
        )
    items = query.limit(50).all()
    return jsonify([{
        'id': p.id,
        'code': p.code,
        'name_ar': p.name_ar,
        'barcode': p.barcode or '',
        'sale_price': float(p.sale_price),
        'vat_rate': float(p.vat_rate),
        'unit': p.unit,
    } for p in items])


# ── Categories ──────────────────────────────────────────────────────────────

@inventory_bp.route('/categories/')
@login_required
def categories():
    cats = Category.query.order_by(Category.name).all()
    return render_template('inventory/categories/index.html', categories=cats)


@inventory_bp.route('/categories/new', methods=['GET', 'POST'])
@login_required
def new_category():
    form = CategoryForm()
    form.parent_id.choices = [(0, '— لا يوجد —')] + [
        (c.id, c.name) for c in Category.query.order_by(Category.name).all()
    ]
    if form.validate_on_submit():
        cat = Category(name=form.name.data,
                       parent_id=form.parent_id.data or None)
        db.session.add(cat)
        db.session.commit()
        flash('تم إضافة الفئة', 'success')
        return redirect(url_for('inventory.categories'))
    return render_template('inventory/categories/form.html', form=form, title='إضافة فئة')


@inventory_bp.route('/categories/<int:id>/edit', methods=['GET', 'POST'])
@login_required
def edit_category(id):
    cat = db.session.get(Category, id)
    if not cat:
        flash('الفئة غير موجودة', 'danger')
        return redirect(url_for('inventory.categories'))
    form = CategoryForm(obj=cat)
    form.parent_id.choices = [(0, '— لا يوجد —')] + [
        (c.id, c.name) for c in Category.query.filter(Category.id != id).order_by(Category.name).all()
    ]
    if form.validate_on_submit():
        cat.name = form.name.data
        cat.parent_id = form.parent_id.data or None
        db.session.commit()
        flash('تم تحديث الفئة', 'success')
        return redirect(url_for('inventory.categories'))
    return render_template('inventory/categories/form.html', form=form, title='تعديل فئة')


# ── Products ─────────────────────────────────────────────────────────────────

@inventory_bp.route('/products/new', methods=['GET', 'POST'])
@login_required
def new_product():
    form = ProductForm()
    form.category_id.choices = [(0, '— اختر فئة —')] + [
        (c.id, c.name) for c in Category.query.order_by(Category.name).all()
    ]
    if form.validate_on_submit():
        product = Product(
            code=form.code.data, barcode=form.barcode.data or None,
            name_ar=form.name_ar.data, name_en=form.name_en.data or None,
            category_id=form.category_id.data or None,
            unit=form.unit.data,
            sale_price=form.sale_price.data,
            cost_price=form.cost_price.data or 0,
            reorder_level=form.reorder_level.data or 0,
            vat_rate=form.vat_rate.data or 5,
        )
        db.session.add(product)
        db.session.commit()
        flash('تم إضافة الصنف', 'success')
        return redirect(url_for('inventory.products'))
    return render_template('inventory/products/form.html', form=form, title='إضافة صنف', product=None)


@inventory_bp.route('/products/<int:id>/edit', methods=['GET', 'POST'])
@login_required
def edit_product(id):
    product = db.session.get(Product, id)
    if not product:
        flash('الصنف غير موجود', 'danger')
        return redirect(url_for('inventory.products'))
    form = ProductForm(obj=product)
    form.category_id.choices = [(0, '— اختر فئة —')] + [
        (c.id, c.name) for c in Category.query.order_by(Category.name).all()
    ]
    if form.validate_on_submit():
        product.code = form.code.data
        product.barcode = form.barcode.data or None
        product.name_ar = form.name_ar.data
        product.name_en = form.name_en.data or None
        product.category_id = form.category_id.data or None
        product.unit = form.unit.data
        product.sale_price = form.sale_price.data
        product.cost_price = form.cost_price.data or 0
        product.reorder_level = form.reorder_level.data or 0
        product.vat_rate = form.vat_rate.data or 5
        db.session.commit()
        flash('تم تحديث الصنف', 'success')
        return redirect(url_for('inventory.products'))
    return render_template('inventory/products/form.html', form=form, title='تعديل صنف', product=product)


@inventory_bp.route('/products/<int:id>/toggle', methods=['POST'])
@login_required
def toggle_product(id):
    product = db.session.get(Product, id)
    if product:
        product.is_active = not product.is_active
        db.session.commit()
        status = 'مفعّل' if product.is_active else 'معطّل'
        flash(f'تم تغيير حالة الصنف إلى {status}', 'info')
    return redirect(url_for('inventory.products'))


# ── Warehouses ────────────────────────────────────────────────────────────────

@inventory_bp.route('/warehouses/')
@login_required
def warehouses():
    whs = Warehouse.query.order_by(Warehouse.name).all()
    return render_template('inventory/warehouses/index.html', warehouses=whs)


@inventory_bp.route('/warehouses/new', methods=['GET', 'POST'])
@login_required
def new_warehouse():
    from ...models.core import Branch
    form = WarehouseForm()
    form.branch_id.choices = [(b.id, b.name) for b in Branch.query.filter_by(is_active=True).all()]
    if form.validate_on_submit():
        wh = Warehouse(name=form.name.data, branch_id=form.branch_id.data,
                       location=form.location.data)
        db.session.add(wh)
        db.session.commit()
        flash('تم إضافة المستودع', 'success')
        return redirect(url_for('inventory.warehouses'))
    return render_template('inventory/warehouses/form.html', form=form, title='إضافة مستودع')


@inventory_bp.route('/warehouses/<int:id>/edit', methods=['GET', 'POST'])
@login_required
def edit_warehouse(id):
    from ...models.core import Branch
    wh = db.session.get(Warehouse, id)
    if not wh:
        flash('المستودع غير موجود', 'danger')
        return redirect(url_for('inventory.warehouses'))
    form = WarehouseForm(obj=wh)
    form.branch_id.choices = [(b.id, b.name) for b in Branch.query.filter_by(is_active=True).all()]
    if form.validate_on_submit():
        wh.name = form.name.data
        wh.branch_id = form.branch_id.data
        wh.location = form.location.data
        db.session.commit()
        flash('تم تحديث المستودع', 'success')
        return redirect(url_for('inventory.warehouses'))
    return render_template('inventory/warehouses/form.html', form=form, title='تعديل مستودع')


# ── Stock Movements ───────────────────────────────────────────────────────────

@inventory_bp.route('/movements/')
@login_required
def movements():
    from sqlalchemy.orm import joinedload
    q = (StockMovement.query
         .options(joinedload(StockMovement.product),
                  joinedload(StockMovement.warehouse))
         .order_by(StockMovement.created_at.desc()))
    return render_template('inventory/movements/index.html', movements=q.limit(200).all())


@inventory_bp.route('/movements/new', methods=['GET', 'POST'])
@login_required
def new_movement():
    form = StockMovementForm()
    form.product_id.choices = [(p.id, f'{p.code} — {p.name_ar}')
                                for p in Product.query.filter_by(is_active=True).order_by(Product.name_ar).all()]
    form.warehouse_id.choices = [(w.id, w.name)
                                  for w in Warehouse.query.order_by(Warehouse.name).all()]
    if form.validate_on_submit():
        qty = float(form.qty.data)
        mov_type = form.type.data
        product_id = form.product_id.data
        warehouse_id = form.warehouse_id.data
        batch_no = form.batch_no.data or None
        expiry = form.expiry_date.data

        if mov_type == 'IN':
            # Find or create batch
            batch = ProductBatch.query.filter_by(
                product_id=product_id, warehouse_id=warehouse_id,
                batch_no=batch_no
            ).first() if batch_no else None
            if batch:
                batch.qty_on_hand = Decimal(str(float(batch.qty_on_hand) + qty))
            else:
                batch = ProductBatch(
                    product_id=product_id, warehouse_id=warehouse_id,
                    batch_no=batch_no or f'MANUAL-{date_type.today().strftime("%Y%m%d")}',
                    expiry_date=expiry, qty_on_hand=Decimal(str(qty)),
                )
                db.session.add(batch)
            db.session.flush()
            move = StockMovement(
                product_id=product_id, batch_id=batch.id,
                warehouse_id=warehouse_id, type='IN', qty=Decimal(str(qty)),
                reference=form.reference.data,
                source='MANUAL', created_by=current_user.id,
            )
            db.session.add(move)
            db.session.commit()
            flash('تم تسجيل الحركة', 'success')
        else:
            try:
                deduct_stock(product_id=product_id, qty=qty,
                             warehouse_id=warehouse_id,
                             reference=form.reference.data,
                             source='MANUAL', created_by=current_user.id)
                db.session.commit()
                flash('تم تسجيل الحركة', 'success')
            except ValueError as e:
                flash(str(e), 'danger')
        return redirect(url_for('inventory.movements'))
    return render_template('inventory/movements/form.html', form=form)


# ── Stock Transfers ───────────────────────────────────────────────────────────

@inventory_bp.route('/transfers/')
@login_required
def transfers():
    ts = StockTransfer.query.order_by(StockTransfer.date.desc()).all()
    return render_template('inventory/transfers/index.html', transfers=ts)


@inventory_bp.route('/transfers/new', methods=['GET', 'POST'])
@login_required
def new_transfer():
    form = StockTransferForm()
    warehouses_list = Warehouse.query.order_by(Warehouse.name).all()
    form.from_warehouse_id.choices = [(w.id, w.name) for w in warehouses_list]
    form.to_warehouse_id.choices = [(w.id, w.name) for w in warehouses_list]
    products = Product.query.filter_by(is_active=True).order_by(Product.name_ar).all()
    if request.method == 'POST' and form.validate_on_submit():
        transfer = StockTransfer(
            from_warehouse_id=form.from_warehouse_id.data,
            to_warehouse_id=form.to_warehouse_id.data,
            date=form.date.data, status='PENDING',
            created_by=current_user.id,
        )
        db.session.add(transfer)
        db.session.flush()
        # Parse line items from form
        product_ids = request.form.getlist('product_id[]')
        qtys = request.form.getlist('qty[]')
        for pid, qty_str in zip(product_ids, qtys):
            try:
                qty = float(qty_str)
                if qty > 0:
                    item = StockTransferItem(
                        transfer_id=transfer.id,
                        product_id=int(pid),
                        qty=Decimal(str(qty)),
                    )
                    db.session.add(item)
            except (ValueError, TypeError):
                pass
        db.session.commit()
        flash('تم إنشاء طلب النقل', 'success')
        return redirect(url_for('inventory.transfer_detail', id=transfer.id))
    return render_template('inventory/transfers/form.html', form=form, products=products)


@inventory_bp.route('/transfers/<int:id>')
@login_required
def transfer_detail(id):
    transfer = db.session.get(StockTransfer, id)
    if not transfer:
        flash('النقل غير موجود', 'danger')
        return redirect(url_for('inventory.transfers'))
    return render_template('inventory/transfers/detail.html', transfer=transfer)


@inventory_bp.route('/transfers/<int:id>/confirm', methods=['POST'])
@login_required
def confirm_transfer(id):
    transfer = db.session.get(StockTransfer, id)
    if not transfer or transfer.status != 'PENDING':
        flash('لا يمكن تأكيد هذا النقل', 'danger')
        return redirect(url_for('inventory.transfers'))
    try:
        for item in transfer.items:
            # Deduct from source warehouse
            deduct_stock(
                product_id=item.product_id, qty=float(item.qty),
                warehouse_id=transfer.from_warehouse_id,
                reference=f'TRANSFER-{transfer.id}',
                source='TRANSFER', created_by=current_user.id,
            )
            # Add to destination warehouse
            dest_batch = ProductBatch.query.filter_by(
                product_id=item.product_id,
                warehouse_id=transfer.to_warehouse_id,
            ).first()
            if dest_batch:
                dest_batch.qty_on_hand = Decimal(str(float(dest_batch.qty_on_hand) + float(item.qty)))
            else:
                dest_batch = ProductBatch(
                    product_id=item.product_id,
                    warehouse_id=transfer.to_warehouse_id,
                    batch_no=f'TRANSFER-{transfer.id}',
                    qty_on_hand=item.qty,
                )
                db.session.add(dest_batch)
            db.session.flush()
            move_in = StockMovement(
                product_id=item.product_id, batch_id=dest_batch.id,
                warehouse_id=transfer.to_warehouse_id,
                type='IN', qty=item.qty,
                reference=f'TRANSFER-{transfer.id}',
                source='TRANSFER', created_by=current_user.id,
            )
            db.session.add(move_in)
        transfer.status = 'CONFIRMED'
        db.session.commit()
        flash('تم تأكيد النقل بنجاح', 'success')
    except ValueError as e:
        db.session.rollback()
        flash(str(e), 'danger')
    return redirect(url_for('inventory.transfer_detail', id=id))


# ── Reorder Alerts ────────────────────────────────────────────────────────────

@inventory_bp.route('/alerts/reorder')
@login_required
def reorder_alerts():
    from sqlalchemy import func
    # Products where total stock < reorder_level AND reorder_level > 0
    stock_sub = (
        db.session.query(
            ProductBatch.product_id,
            func.coalesce(func.sum(ProductBatch.qty_on_hand), 0).label('total_qty')
        )
        .group_by(ProductBatch.product_id)
        .subquery()
    )
    alerts = (
        db.session.query(Product, stock_sub.c.total_qty)
        .outerjoin(stock_sub, Product.id == stock_sub.c.product_id)
        .filter(
            Product.reorder_level > 0,
            Product.is_active == True,
        )
        .filter(
            db.or_(
                stock_sub.c.total_qty == None,
                stock_sub.c.total_qty < Product.reorder_level,
            )
        )
        .order_by(Product.name_ar)
        .all()
    )
    return render_template('inventory/alerts/reorder.html', alerts=alerts)
