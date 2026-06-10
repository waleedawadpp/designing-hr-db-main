from datetime import date, timedelta

from flask import render_template
from flask_login import login_required
from sqlalchemy import func
from sqlalchemy.orm import joinedload

from . import dashboard_bp
from ...extensions import db
from ...models.sales import SalesInvoice, InvoiceItem, InvoiceStatus, InvoiceType, Customer
from ...models.inventory import Product, ProductBatch


def _month_name_ar(month: int) -> str:
    names = {
        1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
        5: 'مايو', 6: 'يونيو', 7: 'يوليو', 8: 'أغسطس',
        9: 'سبتمبر', 10: 'أكتوبر', 11: 'نوفمبر', 12: 'ديسمبر',
    }
    return names.get(month, str(month))


@dashboard_bp.route('/')
@login_required
def index():
    today = date.today()

    # --- KPI 1: Today's Sales ---
    today_sales = db.session.query(
        func.coalesce(func.sum(SalesInvoice.grand_total), 0)
    ).filter(
        SalesInvoice.status == InvoiceStatus.CONFIRMED,
        SalesInvoice.date == today,
    ).scalar() or 0
    today_sales = float(today_sales)

    # --- KPI 2: Month's Sales ---
    month_start = today.replace(day=1)
    month_sales = db.session.query(
        func.coalesce(func.sum(SalesInvoice.grand_total), 0)
    ).filter(
        SalesInvoice.status == InvoiceStatus.CONFIRMED,
        SalesInvoice.date >= month_start,
        SalesInvoice.date <= today,
    ).scalar() or 0
    month_sales = float(month_sales)

    # --- KPI 3: Total Receivables (CONFIRMED CREDIT invoices) ---
    total_receivables = db.session.query(
        func.coalesce(func.sum(SalesInvoice.grand_total), 0)
    ).filter(
        SalesInvoice.status == InvoiceStatus.CONFIRMED,
        SalesInvoice.type == InvoiceType.CREDIT,
    ).scalar() or 0
    total_receivables = float(total_receivables)

    # --- KPI 4: Low Stock Count ---
    # Products where SUM(batch qty_on_hand) < reorder_level (and reorder_level > 0)
    stock_subq = (
        db.session.query(
            ProductBatch.product_id,
            func.coalesce(func.sum(ProductBatch.qty_on_hand), 0).label('total_stock'),
        )
        .group_by(ProductBatch.product_id)
        .subquery()
    )
    low_stock_count = (
        db.session.query(func.count(Product.id))
        .outerjoin(stock_subq, stock_subq.c.product_id == Product.id)
        .filter(
            Product.is_active == True,
            Product.reorder_level > 0,
            func.coalesce(stock_subq.c.total_stock, 0) < Product.reorder_level,
        )
        .scalar() or 0
    )

    # --- Chart: Monthly Sales — last 12 months ---
    chart_labels = []
    chart_data = []

    # Build 12 month buckets
    months = []
    for i in range(11, -1, -1):
        # Go back i months from today's month
        m = today.month - i
        y = today.year
        while m <= 0:
            m += 12
            y -= 1
        months.append((y, m))

    # Query grouped monthly totals for confirmed invoices (last 12 months only)
    cutoff = date(months[0][0], months[0][1], 1)
    yr_col = func.extract('year', SalesInvoice.date).label('yr')
    mo_col = func.extract('month', SalesInvoice.date).label('mo')
    monthly_rows = (
        db.session.query(yr_col, mo_col,
                         func.coalesce(func.sum(SalesInvoice.grand_total), 0).label('total'))
        .filter(SalesInvoice.status == InvoiceStatus.CONFIRMED,
                SalesInvoice.date >= cutoff)
        .group_by(yr_col, mo_col)
        .all()
    )
    monthly_map = {(int(r.yr), int(r.mo)): float(r.total) for r in monthly_rows}

    for (y, m) in months:
        chart_labels.append(f"{_month_name_ar(m)} {y}")
        chart_data.append(monthly_map.get((y, m), 0.0))

    # --- Top 10 Products (last 30 days, by qty sold) ---
    thirty_days_ago = today - timedelta(days=30)
    top_products = (
        db.session.query(
            Product.name_ar,
            func.coalesce(func.sum(InvoiceItem.qty), 0).label('total_qty'),
        )
        .join(InvoiceItem, InvoiceItem.product_id == Product.id)
        .join(SalesInvoice, SalesInvoice.id == InvoiceItem.invoice_id)
        .filter(
            SalesInvoice.status == InvoiceStatus.CONFIRMED,
            SalesInvoice.date >= thirty_days_ago,
        )
        .group_by(Product.id, Product.name_ar)
        .order_by(func.sum(InvoiceItem.qty).desc())
        .limit(10)
        .all()
    )

    # --- Recent 10 Confirmed Invoices (eager-load customer to avoid N+1) ---
    recent_invoices = (
        SalesInvoice.query
        .options(joinedload(SalesInvoice.customer))
        .filter(SalesInvoice.status == InvoiceStatus.CONFIRMED)
        .order_by(SalesInvoice.date.desc(), SalesInvoice.id.desc())
        .limit(10)
        .all()
    )

    return render_template(
        'dashboard/index.html',
        today_sales=today_sales,
        month_sales=month_sales,
        total_receivables=total_receivables,
        low_stock_count=low_stock_count,
        chart_labels=chart_labels,
        chart_data=chart_data,
        top_products=top_products,
        recent_invoices=recent_invoices,
    )
