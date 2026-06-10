from decimal import Decimal
from ..extensions import db


def deduct_stock(product_id: int, qty: float, warehouse_id: int = None,
                 reference: str = None, source: str = 'SALE',
                 created_by: int = None, allow_negative: bool = False):
    """
    Deduct qty from available ProductBatches for a product using FEFO order.
    Iterates through batches (soonest expiry first, NULLS LAST) deducting as
    much as possible from each batch until the full qty is satisfied.
    Creates one StockMovement per batch used.
    Returns the last batch used (for backward compat with item.batch_id assignment).
    Raises ValueError if insufficient stock and allow_negative=False.
    """
    from ..models.inventory import ProductBatch, StockMovement

    query = ProductBatch.query.filter_by(product_id=product_id)
    if warehouse_id:
        query = query.filter_by(warehouse_id=warehouse_id)
    query = query.filter(ProductBatch.qty_on_hand > 0).order_by(
        ProductBatch.expiry_date.asc().nullslast(),
        ProductBatch.id.asc()
    )
    batches = query.all()

    remaining = Decimal(str(qty))
    total_available = sum(Decimal(str(float(b.qty_on_hand))) for b in batches)

    if not allow_negative and total_available < remaining:
        raise ValueError(
            f'الكمية المطلوبة ({qty}) تتجاوز المتاح ({float(total_available):.3f})'
        )

    if not batches:
        raise ValueError(f'لا توجد دفعة متاحة للصنف {product_id}')

    used_batch = None
    for batch in batches:
        if remaining <= 0:
            break
        take = min(remaining, Decimal(str(float(batch.qty_on_hand))))
        batch.qty_on_hand = Decimal(str(float(batch.qty_on_hand))) - take
        move = StockMovement(
            product_id=product_id,
            batch_id=batch.id,
            warehouse_id=batch.warehouse_id,
            type='OUT',
            qty=-take,
            reference=reference,
            source=source,
            created_by=created_by,
        )
        db.session.add(move)
        remaining -= take
        used_batch = batch

    return used_batch  # returns the last batch used (for backward compat with item.batch_id assignment)


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
