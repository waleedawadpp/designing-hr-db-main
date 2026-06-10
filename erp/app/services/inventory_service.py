from decimal import Decimal
from ..extensions import db


def deduct_stock(product_id: int, qty: float, warehouse_id: int = None,
                 reference: str = None, source: str = 'SALE',
                 created_by: int = None, allow_negative: bool = False):
    """
    Deduct qty from the best available ProductBatch for a product.
    Picks the batch with soonest expiry (FEFO) or oldest batch_no.
    Returns the batch used.
    Raises ValueError if insufficient stock and allow_negative=False.
    """
    from ..models.inventory import ProductBatch, StockMovement
    query = ProductBatch.query.filter_by(product_id=product_id)
    if warehouse_id:
        query = query.filter_by(warehouse_id=warehouse_id)
    query = query.order_by(
        ProductBatch.expiry_date.asc().nullslast(),
        ProductBatch.id.asc()
    )
    batch = query.first()
    if not batch:
        raise ValueError(f'لا توجد دفعة متاحة للصنف {product_id}')
    if not allow_negative and float(batch.qty_on_hand) < qty:
        raise ValueError(
            f'الكمية المطلوبة ({qty}) تتجاوز المتاح ({float(batch.qty_on_hand):.3f})'
        )
    batch.qty_on_hand = Decimal(str(float(batch.qty_on_hand) - qty))
    move = StockMovement(
        product_id=product_id,
        batch_id=batch.id,
        warehouse_id=batch.warehouse_id,
        type='OUT',
        qty=Decimal(str(-qty)),
        reference=reference,
        source=source,
        created_by=created_by,
    )
    db.session.add(move)
    return batch


def get_product_stock(product_id: int, warehouse_id: int = None) -> float:
    """Return total qty_on_hand for a product across all (or specific) warehouses."""
    from ..models.inventory import ProductBatch
    from sqlalchemy import func
    query = db.session.query(func.coalesce(func.sum(ProductBatch.qty_on_hand), 0)).filter(
        ProductBatch.product_id == product_id
    )
    if warehouse_id:
        query = query.filter(ProductBatch.warehouse_id == warehouse_id)
    return float(query.scalar())
