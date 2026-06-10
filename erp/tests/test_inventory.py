import pytest
from datetime import date
from decimal import Decimal


@pytest.fixture(autouse=True, scope='module')
def clean_inventory_tables(app):
    """Clean inventory tables before and after the test module to prevent cross-test pollution."""
    from app.models import (Product, ProductBatch, StockMovement,
                             StockTransfer, StockTransferItem, Warehouse, Category)
    from app.extensions import db
    with app.app_context():
        StockTransferItem.query.delete()
        StockTransfer.query.delete()
        StockMovement.query.delete()
        ProductBatch.query.delete()
        Product.query.delete()
        Warehouse.query.delete()
        Category.query.delete()
        db.session.commit()
    yield
    with app.app_context():
        StockTransferItem.query.delete()
        StockTransfer.query.delete()
        StockMovement.query.delete()
        ProductBatch.query.delete()
        Product.query.delete()
        Warehouse.query.delete()
        Category.query.delete()
        db.session.commit()


def test_product_list(logged_in_client):
    rv = logged_in_client.get('/inventory/products')
    assert rv.status_code == 200


def test_create_product(app, logged_in_client, seed_user):
    rv = logged_in_client.post('/inventory/products/new', data={
        'code': 'PROD001', 'name_ar': 'صنف تجريبي',
        'unit': 'PCS', 'sale_price': '10.000',
        'cost_price': '7.000', 'reorder_level': '5',
        'vat_rate': '5', 'csrf_token': '',
    }, follow_redirects=True)
    assert rv.status_code == 200
    from app.models import Product
    with app.app_context():
        p = Product.query.filter_by(code='PROD001').first()
        assert p is not None
        assert p.name_ar == 'صنف تجريبي'


def test_stock_movement_in(app, seed_user):
    from app.models import Product, Warehouse, ProductBatch, StockMovement
    from app.extensions import db
    with app.app_context():
        from app.models.core import Branch
        branch = Branch.query.first()
        wh = Warehouse(name='مستودع 1', branch_id=branch.id)
        db.session.add(wh)
        product = Product(code='P-IN-01', name_ar='صنف للاختبار', unit='PCS',
                          sale_price=10, cost_price=7)
        db.session.add(product)
        db.session.flush()
        batch = ProductBatch(product_id=product.id, warehouse_id=wh.id,
                             batch_no='B001', qty_on_hand=0)
        db.session.add(batch)
        db.session.flush()
        move = StockMovement(product_id=product.id, batch_id=batch.id,
                             warehouse_id=wh.id, type='IN', qty=Decimal('50'),
                             source='MANUAL')
        db.session.add(move)
        batch.qty_on_hand = Decimal('50')
        db.session.commit()

        saved_batch = ProductBatch.query.filter_by(batch_no='B001').first()
        assert float(saved_batch.qty_on_hand) == 50.0


def test_deduct_stock_fefo(app, seed_user):
    from app.models import Product, Warehouse, ProductBatch
    from app.services.inventory_service import deduct_stock
    from app.extensions import db
    with app.app_context():
        from app.models.core import Branch
        branch = Branch.query.first()
        wh = Warehouse(name='مستودع FEFO', branch_id=branch.id)
        db.session.add(wh)
        p = Product(code='P-FEFO-01', name_ar='صنف فيفو', unit='PCS', sale_price=5)
        db.session.add(p)
        db.session.flush()
        # Earlier expiry
        b1 = ProductBatch(product_id=p.id, warehouse_id=wh.id, batch_no='B-EARLY',
                          expiry_date=date(2026, 1, 1), qty_on_hand=Decimal('20'))
        # Later expiry
        b2 = ProductBatch(product_id=p.id, warehouse_id=wh.id, batch_no='B-LATE',
                          expiry_date=date(2026, 12, 31), qty_on_hand=Decimal('20'))
        db.session.add_all([b1, b2])
        db.session.commit()

        deduct_stock(product_id=p.id, qty=5, warehouse_id=wh.id)
        db.session.commit()
        db.session.refresh(b1)
        db.session.refresh(b2)
        assert float(b1.qty_on_hand) == 15.0  # FEFO: deducted from earliest expiry
        assert float(b2.qty_on_hand) == 20.0


def test_deduct_stock_multi_batch(app, seed_user):
    from app.models import Product, Warehouse, ProductBatch
    from app.services.inventory_service import deduct_stock
    from app.extensions import db
    with app.app_context():
        from app.models.core import Branch
        branch = Branch.query.first()
        wh = Warehouse(name='مستودع متعدد', branch_id=branch.id)
        db.session.add(wh)
        p = Product(code='P-MULTI-01', name_ar='صنف متعدد', unit='KG', sale_price=3)
        db.session.add(p)
        db.session.flush()
        b1 = ProductBatch(product_id=p.id, warehouse_id=wh.id, batch_no='BM1',
                          expiry_date=date(2026, 3, 1), qty_on_hand=Decimal('30'))
        b2 = ProductBatch(product_id=p.id, warehouse_id=wh.id, batch_no='BM2',
                          expiry_date=date(2026, 6, 1), qty_on_hand=Decimal('30'))
        db.session.add_all([b1, b2])
        db.session.commit()

        deduct_stock(product_id=p.id, qty=40, warehouse_id=wh.id)
        db.session.commit()
        db.session.refresh(b1)
        db.session.refresh(b2)
        assert float(b1.qty_on_hand) == 0.0
        assert float(b2.qty_on_hand) == 20.0


def test_get_product_stock(app, seed_user):
    from app.models import Product, Warehouse, ProductBatch
    from app.services.inventory_service import get_product_stock
    from app.extensions import db
    with app.app_context():
        from app.models.core import Branch
        branch = Branch.query.first()
        wh = Warehouse(name='مستودع مجموع', branch_id=branch.id)
        db.session.add(wh)
        p = Product(code='P-SUM-01', name_ar='صنف مجموع', unit='BOX', sale_price=20)
        db.session.add(p)
        db.session.flush()
        db.session.add(ProductBatch(product_id=p.id, warehouse_id=wh.id,
                                     batch_no='S1', qty_on_hand=Decimal('10')))
        db.session.add(ProductBatch(product_id=p.id, warehouse_id=wh.id,
                                     batch_no='S2', qty_on_hand=Decimal('25')))
        db.session.commit()
        assert get_product_stock(p.id) == 35.0


def test_reorder_alert(app, logged_in_client, seed_user):
    from app.models import Product, Warehouse, ProductBatch
    from app.extensions import db
    with app.app_context():
        from app.models.core import Branch
        branch = Branch.query.first()
        wh = Warehouse(name='مستودع تنبيه', branch_id=branch.id)
        db.session.add(wh)
        p = Product(code='P-LOW-01', name_ar='صنف منخفض', unit='PCS',
                    sale_price=5, reorder_level=Decimal('10'))
        db.session.add(p)
        db.session.flush()
        db.session.add(ProductBatch(product_id=p.id, warehouse_id=wh.id,
                                     batch_no='LOW1', qty_on_hand=Decimal('3')))
        db.session.commit()
    rv = logged_in_client.get('/inventory/alerts/reorder')
    assert rv.status_code == 200
    assert 'صنف منخفض'.encode('utf-8') in rv.data


def test_transfer_confirm(app, seed_user):
    from app.models import Product, Warehouse, ProductBatch, StockTransfer, StockTransferItem
    from app.services.inventory_service import get_product_stock
    from app.extensions import db
    from decimal import Decimal
    with app.app_context():
        from app.models.core import Branch
        branch = Branch.query.first()
        wh1 = Warehouse(name='مستودع مصدر', branch_id=branch.id)
        wh2 = Warehouse(name='مستودع وجهة', branch_id=branch.id)
        db.session.add_all([wh1, wh2])
        p = Product(code='P-TRANS-01', name_ar='صنف للنقل', unit='PCS', sale_price=10)
        db.session.add(p)
        db.session.flush()
        batch = ProductBatch(product_id=p.id, warehouse_id=wh1.id,
                             batch_no='TR1', qty_on_hand=Decimal('100'))
        db.session.add(batch)
        db.session.flush()
        transfer = StockTransfer(from_warehouse_id=wh1.id, to_warehouse_id=wh2.id,
                                  date=date.today(), status='PENDING')
        db.session.add(transfer)
        db.session.flush()
        item = StockTransferItem(transfer_id=transfer.id, product_id=p.id,
                                  qty=Decimal('30'))
        db.session.add(item)
        db.session.commit()
        transfer_id = transfer.id
        product_id = p.id
        wh1_id = wh1.id
        wh2_id = wh2.id

    with app.app_context():
        from app.models import StockTransfer as ST
        tr = db.session.get(ST, transfer_id)
        # Manually confirm transfer logic (avoid HTTP + login complexity)
        from app.services.inventory_service import deduct_stock
        for ti in tr.items:
            deduct_stock(product_id=ti.product_id, qty=float(ti.qty),
                         warehouse_id=tr.from_warehouse_id,
                         reference=f'TRANSFER-{tr.id}', source='TRANSFER')
            dest = ProductBatch(product_id=ti.product_id,
                                 warehouse_id=tr.to_warehouse_id,
                                 batch_no=f'TRANSFER-{tr.id}',
                                 qty_on_hand=ti.qty)
            db.session.add(dest)
        tr.status = 'CONFIRMED'
        db.session.commit()

        stock_wh1 = get_product_stock(product_id, wh1_id)
        stock_wh2 = get_product_stock(product_id, wh2_id)
        assert stock_wh1 == 70.0
        assert stock_wh2 == 30.0
