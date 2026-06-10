"""Tests for the Dashboard / KPI views (Task 10)."""
import pytest
from datetime import date


@pytest.fixture(autouse=True, scope='module')
def clean_dashboard_tables(app):
    """Clear sales and customer tables before and after this test module."""
    from app.extensions import db
    from app.models.sales import (
        InvoiceItem, ReturnItem, SalesReturn,
        SalesInvoice, QuotationItem, Quotation,
    )
    from app.models.sales import Customer

    def _clear():
        with app.app_context():
            ReturnItem.query.delete()
            SalesReturn.query.delete()
            InvoiceItem.query.delete()
            QuotationItem.query.delete()
            Quotation.query.delete()
            SalesInvoice.query.delete()
            Customer.query.delete()
            db.session.commit()

    _clear()
    yield
    _clear()


# ─────────────────────────────────────────────────────────────────
# Basic load / auth tests
# ─────────────────────────────────────────────────────────────────

def test_dashboard_loads(logged_in_client):
    """GET /dashboard/ returns 200 and contains Arabic dashboard text."""
    rv = logged_in_client.get('/dashboard/')
    assert rv.status_code == 200
    body = rv.data.decode('utf-8')
    assert 'لوحة التحكم' in body


def test_dashboard_requires_login(client):
    """GET /dashboard/ without authentication redirects to login."""
    rv = client.get('/dashboard/', follow_redirects=False)
    assert rv.status_code == 302
    assert '/auth/login' in rv.headers['Location']


# ─────────────────────────────────────────────────────────────────
# Smoke test: KPI with real invoice data
# ─────────────────────────────────────────────────────────────────

def test_kpi_today_sales(app, logged_in_client):
    """
    Create a confirmed invoice dated today and verify the dashboard still
    returns HTTP 200 (smoke test — doesn't assert on the rendered KPI value).
    """
    from app.extensions import db
    from app.models import Branch, Warehouse, Product, ProductBatch, Customer
    from app.models.sales import SalesInvoice, InvoiceItem, InvoiceStatus, InvoiceType

    with app.app_context():
        branch = Branch(code='DBR', name='فرع لوحة التحكم')
        db.session.add(branch)
        db.session.flush()

        warehouse = Warehouse(branch_id=branch.id, name='مستودع لوحة التحكم')
        db.session.add(warehouse)
        db.session.flush()

        product = Product(
            code='DASH01', name_ar='منتج لوحة التحكم',
            sale_price=200, cost_price=100, vat_rate=5, unit='PCS',
            reorder_level=10,
        )
        db.session.add(product)
        db.session.flush()

        batch = ProductBatch(
            product_id=product.id, warehouse_id=warehouse.id,
            batch_no='BDASH001', qty_on_hand=50, unit_cost=100,
        )
        db.session.add(batch)

        customer = Customer(
            name='عميل لوحة التحكم', type='RETAIL',
            credit_limit=10000, branch_id=branch.id,
        )
        db.session.add(customer)
        db.session.flush()

        invoice = SalesInvoice(
            customer_id=customer.id,
            branch_id=branch.id,
            type=InvoiceType.CASH,
            date=date.today(),
            grand_total=210,
            subtotal=200,
            vat_total=10,
            amount_paid=210,
            status=InvoiceStatus.CONFIRMED,
        )
        db.session.add(invoice)
        db.session.flush()

        item = InvoiceItem(
            invoice_id=invoice.id,
            product_id=product.id,
            qty=1,
            unit_price=200,
            discount_pct=0,
            vat_rate=5,
            vat_amount=10,
            line_total=210,
        )
        db.session.add(item)
        db.session.commit()

        inv_id = invoice.id
        prod_id = product.id
        batch_id = batch.id
        cust_id = customer.id
        wh_id = warehouse.id
        br_id = branch.id

    # Dashboard must load without error
    rv = logged_in_client.get('/dashboard/')
    assert rv.status_code == 200
    body = rv.data.decode('utf-8')
    assert 'لوحة التحكم' in body

    # Cleanup
    with app.app_context():
        db.session.query(InvoiceItem).filter_by(invoice_id=inv_id).delete()
        db.session.query(SalesInvoice).filter_by(id=inv_id).delete()
        db.session.query(Customer).filter_by(id=cust_id).delete()
        db.session.query(ProductBatch).filter_by(id=batch_id).delete()
        db.session.query(Product).filter_by(id=prod_id).delete()
        db.session.query(Warehouse).filter_by(id=wh_id).delete()
        db.session.query(Branch).filter_by(id=br_id).delete()
        db.session.commit()
