import pytest
from datetime import date
from decimal import Decimal


@pytest.fixture(autouse=True, scope='module')
def clean_purchasing_tables(app):
    from app.models import GRItem, GoodsReceipt, ImportCost, POItem, PurchaseOrder, Supplier
    from app.extensions import db
    with app.app_context():
        GRItem.query.delete()
        GoodsReceipt.query.delete()
        ImportCost.query.delete()
        POItem.query.delete()
        PurchaseOrder.query.delete()
        Supplier.query.delete()
        db.session.commit()
    yield
    with app.app_context():
        GRItem.query.delete()
        GoodsReceipt.query.delete()
        ImportCost.query.delete()
        POItem.query.delete()
        PurchaseOrder.query.delete()
        Supplier.query.delete()
        db.session.commit()


def _make_supplier(app, db):
    from app.models import Supplier
    s = Supplier(name='مورد اختبار', country='SA', payment_terms=30)
    db.session.add(s)
    db.session.commit()
    return s


def test_supplier_list(logged_in_client):
    rv = logged_in_client.get('/purchasing/suppliers/')
    assert rv.status_code == 200


def test_create_supplier(app, logged_in_client):
    rv = logged_in_client.post('/purchasing/suppliers/new', data={
        'name': 'مورد تجريبي', 'country': 'SA', 'phone': '0501234567',
        'payment_terms': '30', 'csrf_token': '',
    }, follow_redirects=True)
    assert rv.status_code == 200
    from app.models import Supplier
    with app.app_context():
        s = Supplier.query.filter_by(name='مورد تجريبي').first()
        assert s is not None


def test_po_status_flow(app, seed_user):
    from app.models import Supplier, PurchaseOrder, POItem, Product, POStatus
    from app.extensions import db
    with app.app_context():
        supplier = Supplier(name='مورد PO', payment_terms=30)
        db.session.add(supplier)
        from app.models.core import Branch
        branch = Branch.query.first()
        db.session.flush()
        po = PurchaseOrder(supplier_id=supplier.id, branch_id=branch.id,
                           date=date.today(), status=POStatus.DRAFT, currency='SAR')
        db.session.add(po)
        db.session.commit()

        po_id = po.id
        # Approve
        po = db.session.get(PurchaseOrder, po_id)
        po.status = POStatus.APPROVED
        db.session.commit()
        assert db.session.get(PurchaseOrder, po_id).status == POStatus.APPROVED


def test_calculate_po_total(app, seed_user):
    from app.models import Supplier, PurchaseOrder, POItem, Product, POStatus
    from app.services.purchasing_service import calculate_po_total
    from app.extensions import db
    with app.app_context():
        supplier = Supplier(name='مورد مجموع', payment_terms=30)
        db.session.add(supplier)
        from app.models.core import Branch
        branch = Branch.query.first()
        db.session.flush()
        po = PurchaseOrder(supplier_id=supplier.id, branch_id=branch.id,
                           date=date.today(), status=POStatus.DRAFT)
        db.session.add(po)
        db.session.flush()
        product = Product(code='P-PO-TOTAL', name_ar='صنف PO مجموع', unit='PCS', sale_price=100)
        db.session.add(product)
        db.session.flush()
        item = POItem(po_id=po.id, product_id=product.id,
                      qty=Decimal('10'), unit_price=Decimal('50'),
                      total_price=Decimal('500'))
        db.session.add(item)
        db.session.commit()

        po = db.session.get(PurchaseOrder, po.id)
        calculate_po_total(po)
        db.session.commit()
        assert float(po.total_amount) == 500.0


def test_goods_receipt_creates_batch(app, seed_user):
    from app.models import (Supplier, PurchaseOrder, POItem, GoodsReceipt, GRItem,
                             Product, Warehouse, ProductBatch, POStatus)
    from app.services.purchasing_service import confirm_goods_receipt
    from app.services.inventory_service import get_product_stock
    from app.extensions import db
    with app.app_context():
        supplier = Supplier(name='مورد GR', payment_terms=30)
        db.session.add(supplier)
        from app.models.core import Branch
        branch = Branch.query.first()
        wh = Warehouse(name='مستودع GR', branch_id=branch.id)
        db.session.add(wh)
        db.session.flush()
        po = PurchaseOrder(supplier_id=supplier.id, branch_id=branch.id,
                           date=date.today(), status=POStatus.APPROVED)
        db.session.add(po)
        db.session.flush()
        product = Product(code='P-GR-01', name_ar='صنف GR', unit='PCS', sale_price=50)
        db.session.add(product)
        db.session.flush()
        po_item = POItem(po_id=po.id, product_id=product.id,
                         qty=Decimal('100'), unit_price=Decimal('40'),
                         total_price=Decimal('4000'))
        db.session.add(po_item)
        receipt = GoodsReceipt(po_id=po.id, warehouse_id=wh.id, date=date.today())
        db.session.add(receipt)
        db.session.flush()
        gr_item = GRItem(receipt_id=receipt.id, product_id=product.id,
                         qty_received=Decimal('100'), batch_no='GR-B01',
                         unit_cost=Decimal('40'))
        db.session.add(gr_item)
        db.session.commit()
        receipt_id = receipt.id
        product_id = product.id

    with app.app_context():
        confirm_goods_receipt(receipt_id)
        stock = get_product_stock(product_id)
        assert stock == 100.0


def test_landed_cost_distribution(app, seed_user):
    from app.models import (Supplier, PurchaseOrder, POItem, GoodsReceipt, GRItem,
                             ImportCost, Product, Warehouse, POStatus)
    from app.services.purchasing_service import confirm_goods_receipt, distribute_landed_cost
    from app.extensions import db
    with app.app_context():
        supplier = Supplier(name='مورد landed cost', payment_terms=30)
        db.session.add(supplier)
        from app.models.core import Branch
        branch = Branch.query.first()
        wh = Warehouse(name='مستودع landed', branch_id=branch.id)
        db.session.add(wh)
        db.session.flush()
        po = PurchaseOrder(supplier_id=supplier.id, branch_id=branch.id,
                           date=date.today(), status=POStatus.APPROVED)
        db.session.add(po)
        db.session.flush()
        product = Product(code='P-LC-01', name_ar='صنف landed', unit='KG', sale_price=20)
        db.session.add(product)
        db.session.flush()
        poi = POItem(po_id=po.id, product_id=product.id,
                     qty=Decimal('100'), unit_price=Decimal('10'), total_price=Decimal('1000'))
        db.session.add(poi)
        ic = ImportCost(po_id=po.id, cost_type='SHIPPING', amount=Decimal('300'))
        db.session.add(ic)
        receipt = GoodsReceipt(po_id=po.id, warehouse_id=wh.id, date=date.today())
        db.session.add(receipt)
        db.session.flush()
        gr_item = GRItem(receipt_id=receipt.id, product_id=product.id,
                         qty_received=Decimal('100'), unit_cost=Decimal('10'))
        db.session.add(gr_item)
        db.session.commit()
        receipt_id = receipt.id
        product_id = product.id

    with app.app_context():
        confirm_goods_receipt(receipt_id)
        from app.models import GoodsReceipt as GR, GRItem as GRI
        r = db.session.get(GR, receipt_id)
        items = list(r.items)
        # All cost distributed to single item
        assert float(items[0].landed_cost) == 300.0
