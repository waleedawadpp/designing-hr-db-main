import json
from datetime import date as date_type

from flask import render_template, redirect, url_for, flash, request, make_response
from flask_login import login_required, current_user

from . import sales_bp
from .forms import CustomerForm
from ...extensions import db
from ...models import (
    Customer, SalesInvoice, InvoiceItem, InvoiceType, InvoiceStatus,
    Product
)
from ...services.sales_service import (
    calculate_invoice_totals, recalculate_invoice,
    assign_invoice_no, confirm_invoice
)


# ──────────────────── CUSTOMERS ────────────────────

@sales_bp.route('/customers/')
@login_required
def customers():
    items = Customer.query.filter_by(is_active=True).order_by(Customer.name).all()
    return render_template('sales/customers/index.html', customers=items)


@sales_bp.route('/customers/add', methods=['GET', 'POST'])
@login_required
def add_customer():
    form = CustomerForm()
    if form.validate_on_submit():
        customer = Customer(
            name=form.name.data,
            type=form.type.data,
            phone=form.phone.data or None,
            address=form.address.data or None,
            tax_no=form.tax_no.data or None,
            credit_limit=float(form.credit_limit.data or 0),
            branch_id=current_user.branch_id,
        )
        db.session.add(customer)
        db.session.commit()
        flash(f'تم إضافة العميل "{customer.name}" بنجاح', 'success')
        return redirect(url_for('sales.customers'))
    return render_template('sales/customers/form.html', form=form, title='إضافة عميل')


@sales_bp.route('/customers/<int:customer_id>/edit', methods=['GET', 'POST'])
@login_required
def edit_customer(customer_id):
    customer = db.session.get(Customer, customer_id)
    if not customer:
        flash('العميل غير موجود', 'danger')
        return redirect(url_for('sales.customers'))
    form = CustomerForm(obj=customer)
    if form.validate_on_submit():
        customer.name = form.name.data
        customer.type = form.type.data
        customer.phone = form.phone.data or None
        customer.address = form.address.data or None
        customer.tax_no = form.tax_no.data or None
        customer.credit_limit = float(form.credit_limit.data or 0)
        db.session.commit()
        flash('تم تعديل بيانات العميل', 'success')
        return redirect(url_for('sales.customers'))
    form.credit_limit.data = str(customer.credit_limit or '')
    return render_template('sales/customers/form.html', form=form, title='تعديل عميل')


# ──────────────────── INVOICES ────────────────────

@sales_bp.route('/invoices/')
@login_required
def invoices():
    query = SalesInvoice.query.order_by(SalesInvoice.date.desc(), SalesInvoice.id.desc())
    if not current_user.is_general_manager:
        query = query.filter_by(branch_id=current_user.branch_id)
    items = query.limit(200).all()
    return render_template('sales/invoices/index.html', invoices=items)


@sales_bp.route('/invoices/new', methods=['GET', 'POST'])
@login_required
def new_invoice():
    customers = Customer.query.filter_by(is_active=True).order_by(Customer.name).all()
    products = Product.query.filter_by(is_active=True).order_by(Product.name_ar).all()
    products_json = json.dumps([{
        'id': p.id, 'name_ar': p.name_ar, 'code': p.code,
        'barcode': p.barcode or '', 'sale_price': float(p.sale_price),
        'vat_rate': float(p.vat_rate), 'unit': p.unit,
    } for p in products])

    if request.method == 'POST':
        customer_id = request.form.get('customer_id')
        invoice_type = request.form.get('invoice_type', InvoiceType.CASH)
        invoice_date = request.form.get('date')
        due_date = request.form.get('due_date') or None
        action = request.form.get('action', 'save_draft')
        notes = request.form.get('notes', '')

        lines_json = request.form.get('lines_json', '[]')
        try:
            lines = json.loads(lines_json)
        except (json.JSONDecodeError, ValueError):
            lines = []

        if not customer_id or not lines:
            flash('يجب اختيار العميل وإضافة صنف واحد على الأقل', 'danger')
            return render_template('sales/invoices/form.html',
                                   customers=customers, products_json=products_json,
                                   today=date_type.today().isoformat())

        # Check credit limit for credit invoices
        if invoice_type == InvoiceType.CREDIT:
            customer = db.session.get(Customer, int(customer_id))
            if customer and customer.is_over_credit_limit():
                flash(f'تحذير: العميل "{customer.name}" تجاوز حد الائتمان ({float(customer.credit_limit):.3f})', 'warning')

        invoice = SalesInvoice(
            customer_id=int(customer_id),
            branch_id=current_user.branch_id,
            type=invoice_type,
            date=date_type.fromisoformat(invoice_date),
            due_date=date_type.fromisoformat(due_date) if due_date else None,
            notes=notes,
            status=InvoiceStatus.DRAFT,
            created_by=current_user.id,
        )
        db.session.add(invoice)
        db.session.flush()
        assign_invoice_no(invoice)

        for line in lines:
            item = InvoiceItem(
                invoice_id=invoice.id,
                product_id=int(line['product_id']),
                qty=float(line['qty']),
                unit_price=float(line['unit_price']),
                discount_pct=float(line.get('discount_pct', 0)),
                vat_rate=float(line.get('vat_rate', 5)),
            )
            db.session.add(item)

        db.session.flush()
        recalculate_invoice(invoice)

        if action == 'confirm':
            try:
                db.session.commit()
                confirm_invoice(invoice.id)
                flash(f'تم تأكيد الفاتورة {invoice.invoice_no} وخصم المخزون', 'success')
            except ValueError as e:
                db.session.rollback()
                flash(str(e), 'danger')
                return render_template('sales/invoices/form.html',
                                       customers=customers, products_json=products_json,
                                       today=date_type.today().isoformat())
        else:
            db.session.commit()
            flash(f'تم حفظ الفاتورة {invoice.invoice_no} كمسودة', 'success')

        return redirect(url_for('sales.invoice_detail', invoice_id=invoice.id))

    return render_template('sales/invoices/form.html',
                           customers=customers, products_json=products_json,
                           today=date_type.today().isoformat())


@sales_bp.route('/invoices/<int:invoice_id>')
@login_required
def invoice_detail(invoice_id):
    invoice = db.session.get(SalesInvoice, invoice_id)
    if not invoice:
        flash('الفاتورة غير موجودة', 'danger')
        return redirect(url_for('sales.invoices'))
    return render_template('sales/invoices/detail.html', invoice=invoice)


@sales_bp.route('/invoices/<int:invoice_id>/confirm', methods=['POST'])
@login_required
def invoice_confirm(invoice_id):
    try:
        invoice = confirm_invoice(invoice_id)
        flash(f'تم تأكيد الفاتورة {invoice.invoice_no}', 'success')
    except ValueError as e:
        flash(str(e), 'danger')
    return redirect(url_for('sales.invoice_detail', invoice_id=invoice_id))


@sales_bp.route('/invoices/<int:invoice_id>/print')
@login_required
def invoice_print(invoice_id):
    invoice = db.session.get(SalesInvoice, invoice_id)
    if not invoice:
        flash('الفاتورة غير موجودة', 'danger')
        return redirect(url_for('sales.invoices'))
    from ...models.core import Branch
    branch = db.session.get(Branch, invoice.branch_id)
    return render_template('sales/invoices/print.html',
                           invoice=invoice, branch=branch,
                           company_name='نظام ERP — شركة التوزيع')
