from decimal import Decimal
from datetime import date as date_type
from ..extensions import db


def calculate_po_total(po):
    """Recalculate and save PO total from line items."""
    total = sum(float(item.qty) * float(item.unit_price) for item in po.items)
    po.total_amount = total
    return total


def distribute_landed_cost(receipt):
    """
    Distribute import costs proportionally across GR items by qty.
    Sets GRItem.landed_cost = (item_qty / total_qty) * total_import_costs.
    Updates ProductBatch.landed_cost for each GRItem's batch.
    """
    items = list(receipt.items)
    if not items:
        return
    total_qty = sum(float(item.qty_received) for item in items)
    if total_qty == 0:
        return

    # Sum all import costs for this PO
    total_import = sum(float(c.amount) for c in receipt.po.import_costs)

    for item in items:
        share = (float(item.qty_received) / total_qty) * total_import
        item.landed_cost = Decimal(str(round(share, 3)))
        # Update the linked batch's landed_cost too
        if item.batch_id:
            from ..models.inventory import ProductBatch
            batch = db.session.get(ProductBatch, item.batch_id)
            if batch:
                batch.landed_cost = item.landed_cost


def confirm_goods_receipt(receipt_id: int, created_by: int = None):
    """
    Confirm a GoodsReceipt:
    1. Create ProductBatch for each GR item
    2. Create StockMovement IN for each item
    3. Distribute landed cost
    4. Generate purchase journal entry
    5. Set PO status to RECEIVED
    Returns the receipt.
    """
    import logging
    from ..models.purchasing import GoodsReceipt, POStatus
    from ..models.inventory import ProductBatch, StockMovement
    from ..services.accounting_service import create_purchase_journal_entry

    logger = logging.getLogger(__name__)
    receipt = db.session.get(GoodsReceipt, receipt_id)
    if not receipt:
        raise ValueError('استلام البضاعة غير موجود')

    for item in receipt.items:
        batch = ProductBatch(
            product_id=item.product_id,
            warehouse_id=receipt.warehouse_id,
            batch_no=item.batch_no or f'GR-{receipt.id}',
            expiry_date=item.expiry_date,
            qty_on_hand=item.qty_received,
            unit_cost=item.unit_cost,
            landed_cost=Decimal('0'),
        )
        db.session.add(batch)
        db.session.flush()
        item.batch_id = batch.id

        move = StockMovement(
            product_id=item.product_id,
            batch_id=batch.id,
            warehouse_id=receipt.warehouse_id,
            type='IN',
            qty=item.qty_received,
            reference=f'GR-{receipt.id}',
            source='PURCHASE',
            created_by=created_by,
        )
        db.session.add(move)

    # Distribute landed cost from import costs
    distribute_landed_cost(receipt)

    # Generate journal entry
    try:
        journal = create_purchase_journal_entry(receipt)
        if journal is not None:
            receipt.journal_id = journal.id
    except Exception:
        logger.exception('Failed to create journal for GR %s', receipt.id)

    # Update PO status
    receipt.po.status = POStatus.RECEIVED
    db.session.commit()
    return receipt
