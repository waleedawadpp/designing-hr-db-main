import json
import pytest
from datetime import date


@pytest.fixture(autouse=True, scope='module')
def clean_sales_tables(app):
    from app.extensions import db
    from app.models.sales import InvoiceItem, ReturnItem, SalesReturn, SalesInvoice, QuotationItem, Quotation
    from app.models import Customer
    with app.app_context():
        ReturnItem.query.delete()
        SalesReturn.query.delete()
        InvoiceItem.query.delete()
        QuotationItem.query.delete()
        Quotation.query.delete()
        SalesInvoice.query.delete()
        Customer.query.delete()
        db.session.commit()
    yield
    with app.app_context():
        ReturnItem.query.delete()
        SalesReturn.query.delete()
        InvoiceItem.query.delete()
        QuotationItem.query.delete()
        Quotation.query.delete()
        SalesInvoice.query.delete()
        Customer.query.delete()
        db.session.commit()


@pytest.fixture(scope='function')
def seed_sales_data(app):
    """Create a branch, warehouse, product, customer for sales tests."""
    from app.extensions import db
    from app.models import Branch, Warehouse, Product, ProductBatch, Customer
    with app.app_context():
        branch = Branch(code='SB', name='فرع المبيعات')
        db.session.add(branch)
        db.session.flush()

        warehouse = Warehouse(branch_id=branch.id, name='مستودع رئيسي')
        db.session.add(warehouse)
        db.session.flush()

        product = Product(
            code='P001', name_ar='منتج اختبار',
            sale_price=100, cost_price=60, vat_rate=5, unit='PCS'
        )
        db.session.add(product)
        db.session.flush()

        batch = ProductBatch(
            product_id=product.id, warehouse_id=warehouse.id,
            batch_no='BATCH001', qty_on_hand=50, unit_cost=60
        )
        db.session.add(batch)

        customer = Customer(name='عميل اختبار', type='RETAIL',
                            credit_limit=5000, branch_id=branch.id)
        db.session.add(customer)
        db.session.commit()

        yield {
            'branch_id': branch.id,
            'warehouse_id': warehouse.id,
            'product_id': product.id,
            'batch_id': batch.id,
            'customer_id': customer.id,
        }

        db.session.query(ProductBatch).delete()
        db.session.query(Product).delete()
        db.session.query(Customer).delete()
        db.session.query(Warehouse).delete()
        db.session.query(Branch).filter_by(code='SB').delete()
        db.session.commit()


def test_invoices_list_loads(logged_in_client):
    rv = logged_in_client.get('/sales/invoices/')
    assert rv.status_code == 200
    assert 'فواتير البيع' in rv.data.decode('utf-8')


def test_customers_list_loads(logged_in_client):
    rv = logged_in_client.get('/sales/customers/')
    assert rv.status_code == 200
    assert 'العملاء' in rv.data.decode('utf-8')


def test_add_customer(app, logged_in_client):
    rv = logged_in_client.post('/sales/customers/new', data={
        'name': 'عميل جديد',
        'type': 'WHOLESALE',
        'phone': '0501234567',
        'address': 'الرياض',
        'tax_no': '',
        'credit_limit': '10000',
    }, follow_redirects=True)
    assert rv.status_code == 200
    assert 'تم إضافة العميل' in rv.data.decode('utf-8')
    with app.app_context():
        from app.models import Customer
        from app.extensions import db
        c = Customer.query.filter_by(name='عميل جديد').first()
        assert c is not None
        db.session.delete(c)
        db.session.commit()


def test_vat_calculation():
    """5% VAT is applied correctly — pure function test."""
    from app.services.sales_service import calculate_invoice_totals
    items = [{'qty': 10, 'unit_price': 100, 'discount_pct': 0, 'vat_rate': 5}]
    result = calculate_invoice_totals(items)
    assert result['subtotal'] == 1000.0
    assert result['vat_total'] == 50.0
    assert result['grand_total'] == 1050.0


def test_vat_calculation_with_discount():
    """Discount applied before VAT."""
    from app.services.sales_service import calculate_invoice_totals
    items = [{'qty': 10, 'unit_price': 100, 'discount_pct': 10, 'vat_rate': 5}]
    result = calculate_invoice_totals(items)
    assert result['subtotal'] == 1000.0
    assert result['discount_total'] == 100.0
    assert abs(result['vat_total'] - 45.0) < 0.001   # 5% of 900
    assert abs(result['grand_total'] - 945.0) < 0.001


def test_create_draft_invoice(app, logged_in_client, seed_sales_data):
    data = seed_sales_data
    lines = json.dumps([{
        'product_id': str(data['product_id']),
        'qty': '5',
        'unit_price': '100',
        'discount_pct': '0',
        'vat_rate': '5',
    }])
    rv = logged_in_client.post('/sales/invoices/new', data={
        'customer_id': str(data['customer_id']),
        'invoice_type': 'CASH',
        'date': date.today().isoformat(),
        'due_date': '',
        'action': 'save_draft',
        'lines_json': lines,
    }, follow_redirects=True)
    assert rv.status_code == 200
    assert 'مسودة' in rv.data.decode('utf-8')
    with app.app_context():
        from app.models import SalesInvoice, InvoiceItem
        from app.extensions import db
        inv = SalesInvoice.query.filter_by(customer_id=data['customer_id']).first()
        assert inv is not None
        assert inv.status == 'DRAFT'
        assert abs(float(inv.grand_total) - 525.0) < 0.01  # 5*100 + 5% VAT
        db.session.query(InvoiceItem).filter_by(invoice_id=inv.id).delete()
        db.session.delete(inv)
        db.session.commit()


def test_confirm_invoice_deducts_stock(app, logged_in_client, seed_sales_data):
    data = seed_sales_data
    lines = json.dumps([{
        'product_id': str(data['product_id']),
        'qty': '3',
        'unit_price': '100',
        'discount_pct': '0',
        'vat_rate': '5',
    }])
    rv = logged_in_client.post('/sales/invoices/new', data={
        'customer_id': str(data['customer_id']),
        'invoice_type': 'CASH',
        'date': date.today().isoformat(),
        'action': 'confirm',
        'lines_json': lines,
    }, follow_redirects=True)
    assert rv.status_code == 200
    with app.app_context():
        from app.models import SalesInvoice, InvoiceItem, ProductBatch
        from app.extensions import db
        inv = SalesInvoice.query.filter_by(customer_id=data['customer_id'],
                                           status='CONFIRMED').first()
        assert inv is not None
        batch = db.session.get(ProductBatch, data['batch_id'])
        assert float(batch.qty_on_hand) == 47.0  # 50 - 3
        # cleanup
        db.session.query(InvoiceItem).filter_by(invoice_id=inv.id).delete()
        db.session.delete(inv)
        db.session.commit()


def test_credit_limit_warning(app, logged_in_client):
    """Customer over credit limit returns True; customer with no limit returns False."""
    from app.extensions import db
    from app.models import Customer, Branch, SalesInvoice, InvoiceStatus, InvoiceType
    with app.app_context():
        branch = Branch(code='CLB', name='فرع حد ائتمان')
        db.session.add(branch)
        db.session.flush()

        # Customer with a credit_limit=100 and outstanding CREDIT invoice of 200
        customer = Customer(name='عميل محدود', credit_limit=100,
                            type='RETAIL', branch_id=branch.id)
        db.session.add(customer)
        db.session.flush()
        inv = SalesInvoice(
            customer_id=customer.id, branch_id=branch.id,
            type=InvoiceType.CREDIT, date=date.today(),
            grand_total=200, amount_paid=0, status=InvoiceStatus.CONFIRMED
        )
        db.session.add(inv)

        # Customer with credit_limit=0 (no limit) — should never be over limit
        customer_no_limit = Customer(name='عميل بلا حد', credit_limit=0,
                                     type='RETAIL', branch_id=branch.id)
        db.session.add(customer_no_limit)
        db.session.commit()

        cust_id = customer.id
        cust_no_limit_id = customer_no_limit.id
        inv_id = inv.id
        branch_id = branch.id

        # Re-fetch inside the same context to ensure ORM state is fresh
        c = db.session.get(Customer, cust_id)
        c_no_limit = db.session.get(Customer, cust_no_limit_id)

        assert c.is_over_credit_limit() is True, (
            "Customer with outstanding balance > credit_limit should return True"
        )
        assert c_no_limit.is_over_credit_limit() is False, (
            "Customer with credit_limit=0 should never be over limit"
        )

    # Cleanup
    with app.app_context():
        from app.models import SalesInvoice, Customer, Branch
        db.session.query(SalesInvoice).filter_by(id=inv_id).delete()
        db.session.query(Customer).filter_by(id=cust_id).delete()
        db.session.query(Customer).filter_by(id=cust_no_limit_id).delete()
        db.session.query(Branch).filter_by(id=branch_id).delete()
        db.session.commit()


def test_double_confirm_raises(app, seed_user):
    """Confirming an already-confirmed invoice raises ValueError."""
    from app.extensions import db
    from app.models import (
        Branch, Warehouse, Product, ProductBatch, Customer,
        SalesInvoice, InvoiceItem, InvoiceStatus, InvoiceType
    )
    from app.services.sales_service import assign_invoice_no, confirm_invoice
    with app.app_context():
        branch = db.session.get(Branch, seed_user.branch_id)
        warehouse = Warehouse(branch_id=branch.id, name='مستودع مزدوج')
        db.session.add(warehouse)
        db.session.flush()

        product = Product(
            code='PDC01', name_ar='منتج مزدوج',
            sale_price=50, cost_price=30, vat_rate=5, unit='PCS'
        )
        db.session.add(product)
        db.session.flush()

        batch = ProductBatch(
            product_id=product.id, warehouse_id=warehouse.id,
            batch_no='BDBL001', qty_on_hand=100, unit_cost=30
        )
        db.session.add(batch)

        customer = Customer(name='عميل مزدوج', type='RETAIL',
                            credit_limit=0, branch_id=branch.id)
        db.session.add(customer)
        db.session.flush()

        invoice = SalesInvoice(
            customer_id=customer.id, branch_id=branch.id,
            type=InvoiceType.CASH, date=date.today(),
            status=InvoiceStatus.DRAFT, created_by=seed_user.id
        )
        db.session.add(invoice)
        db.session.flush()
        assign_invoice_no(invoice)

        item = InvoiceItem(
            invoice_id=invoice.id, product_id=product.id,
            qty=1, unit_price=50, discount_pct=0, vat_rate=5
        )
        db.session.add(item)
        db.session.commit()
        inv_id = invoice.id

        # First confirmation should succeed
        confirm_invoice(inv_id)

        # Second confirmation must raise ValueError
        import pytest as _pytest
        with _pytest.raises(ValueError):
            confirm_invoice(inv_id)

        # Cleanup
        from app.models import InvoiceItem as II
        db.session.query(II).filter_by(invoice_id=inv_id).delete()
        db.session.query(SalesInvoice).filter_by(id=inv_id).delete()
        db.session.query(Customer).filter_by(id=customer.id).delete()
        db.session.query(ProductBatch).filter_by(id=batch.id).delete()
        db.session.query(Product).filter_by(id=product.id).delete()
        db.session.query(Warehouse).filter_by(id=warehouse.id).delete()
        db.session.commit()


def test_invoice_no_format(app, seed_user):
    """Confirmed invoice has invoice_no matching ^[A-Z0-9]+-\\d{4}-\\d{5}$ with correct year."""
    import re
    from app.extensions import db
    from app.models import (
        Branch, Warehouse, Product, ProductBatch, Customer,
        SalesInvoice, InvoiceItem, InvoiceStatus, InvoiceType
    )
    from app.services.sales_service import assign_invoice_no, confirm_invoice
    with app.app_context():
        branch = db.session.get(Branch, seed_user.branch_id)
        warehouse = Warehouse(branch_id=branch.id, name='مستودع تنسيق')
        db.session.add(warehouse)
        db.session.flush()

        product = Product(
            code='PFMT01', name_ar='منتج تنسيق',
            sale_price=80, cost_price=50, vat_rate=5, unit='PCS'
        )
        db.session.add(product)
        db.session.flush()

        batch = ProductBatch(
            product_id=product.id, warehouse_id=warehouse.id,
            batch_no='BFMT001', qty_on_hand=50, unit_cost=50
        )
        db.session.add(batch)

        customer = Customer(name='عميل تنسيق', type='RETAIL',
                            credit_limit=0, branch_id=branch.id)
        db.session.add(customer)
        db.session.flush()

        invoice = SalesInvoice(
            customer_id=customer.id, branch_id=branch.id,
            type=InvoiceType.CASH, date=date.today(),
            status=InvoiceStatus.DRAFT, created_by=seed_user.id
        )
        db.session.add(invoice)
        db.session.flush()
        assign_invoice_no(invoice)

        item = InvoiceItem(
            invoice_id=invoice.id, product_id=product.id,
            qty=2, unit_price=80, discount_pct=0, vat_rate=5
        )
        db.session.add(item)
        db.session.commit()
        inv_id = invoice.id

        confirmed = confirm_invoice(inv_id)
        invoice_no = confirmed.invoice_no

        pattern = r'^[A-Z0-9]+-\d{4}-\d{5}$'
        assert re.match(pattern, invoice_no), (
            f"invoice_no '{invoice_no}' does not match pattern '{pattern}'"
        )
        year_in_no = int(invoice_no.split('-')[-2])
        assert year_in_no == date.today().year, (
            f"Year in invoice_no ({year_in_no}) does not match current year ({date.today().year})"
        )

        # Cleanup
        from app.models import InvoiceItem as II
        db.session.query(II).filter_by(invoice_id=inv_id).delete()
        db.session.query(SalesInvoice).filter_by(id=inv_id).delete()
        db.session.query(Customer).filter_by(id=customer.id).delete()
        db.session.query(ProductBatch).filter_by(id=batch.id).delete()
        db.session.query(Product).filter_by(id=product.id).delete()
        db.session.query(Warehouse).filter_by(id=warehouse.id).delete()
        db.session.commit()
