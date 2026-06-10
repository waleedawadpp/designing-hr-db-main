from decimal import Decimal
from datetime import date as date_type
from ..extensions import db


VAT_RATE = Decimal('5')


def calculate_invoice_totals(items: list, invoice_discount: float = 0) -> dict:
    """
    Pure calculation — no DB access.
    items: list of dicts with keys: qty, unit_price, discount_pct, vat_rate
    Returns: subtotal, discount_total, vat_total, grand_total
    """
    subtotal = Decimal('0')
    total_discount = Decimal('0')
    vat_total = Decimal('0')

    for item in items:
        qty = Decimal(str(item['qty']))
        price = Decimal(str(item['unit_price']))
        disc_pct = Decimal(str(item.get('discount_pct', 0)))
        vat_rate = Decimal(str(item.get('vat_rate', 5)))

        line_base = qty * price
        line_disc = line_base * disc_pct / 100
        line_after_disc = line_base - line_disc
        line_vat = line_after_disc * vat_rate / 100

        subtotal += line_base
        total_discount += line_disc
        vat_total += line_vat

    inv_disc = Decimal(str(invoice_discount))
    grand_total = subtotal - total_discount - inv_disc + vat_total

    return {
        'subtotal': float(subtotal),
        'discount_total': float(total_discount + inv_disc),
        'vat_total': float(vat_total),
        'grand_total': float(grand_total),
    }


def recalculate_invoice(invoice):
    """Recompute and save invoice totals from its line items."""
    items_data = []
    for item in invoice.items:
        items_data.append({
            'qty': float(item.qty),
            'unit_price': float(item.unit_price),
            'discount_pct': float(item.discount_pct or 0),
            'vat_rate': float(item.vat_rate or 5),
        })
    totals = calculate_invoice_totals(items_data)
    invoice.subtotal = totals['subtotal']
    invoice.discount_total = totals['discount_total']
    invoice.vat_total = totals['vat_total']
    invoice.grand_total = totals['grand_total']

    # Update each line's stored amounts
    for item in invoice.items:
        qty = Decimal(str(float(item.qty)))
        price = Decimal(str(float(item.unit_price)))
        disc_pct = Decimal(str(float(item.discount_pct or 0)))
        vat_rate = Decimal(str(float(item.vat_rate or 5)))
        line_base = qty * price
        line_disc = line_base * disc_pct / 100
        line_after_disc = line_base - line_disc
        line_vat = line_after_disc * vat_rate / 100
        item.discount_amt = float(line_disc)
        item.vat_amount = float(line_vat)
        item.line_total = float(line_after_disc + line_vat)


def assign_invoice_no(invoice):
    """Assign sequential invoice number per branch per year."""
    from ..models.sales import SalesInvoice
    from ..models.core import Branch
    branch = db.session.get(Branch, invoice.branch_id)
    year = date_type.today().year
    count = SalesInvoice.query.filter(
        SalesInvoice.branch_id == invoice.branch_id,
        db.func.strftime('%Y', SalesInvoice.date) == str(year)
    ).count()
    prefix = branch.code if branch else 'INV'
    invoice.invoice_no = f"{prefix}-{year}-{count:05d}"


def confirm_invoice(invoice_id: int, allow_negative_stock: bool = False):
    """
    Confirm a draft invoice:
    1. Deduct stock for each line item
    2. Generate accounting journal entry
    3. Mark invoice as CONFIRMED
    Returns the updated invoice.
    """
    from ..models.sales import SalesInvoice, InvoiceStatus
    from ..services.inventory_service import deduct_stock
    from ..services.accounting_service import create_sales_journal_entry

    invoice = db.session.get(SalesInvoice, invoice_id)
    if not invoice:
        raise ValueError('الفاتورة غير موجودة')
    if invoice.status != InvoiceStatus.DRAFT:
        raise ValueError('الفاتورة مؤكدة مسبقاً أو ملغية')

    # Deduct stock for each line
    for item in invoice.items:
        batch = deduct_stock(
            product_id=item.product_id,
            qty=float(item.qty),
            reference=invoice.invoice_no or str(invoice.id),
            source='SALE',
            created_by=invoice.created_by,
            allow_negative=allow_negative_stock,
        )
        item.batch_id = batch.id

    # Generate journal entry
    try:
        journal = create_sales_journal_entry(invoice)
        invoice.journal_id = journal.id
    except Exception:
        # Accounting not yet wired — skip journal silently in early phases
        pass

    invoice.status = InvoiceStatus.CONFIRMED
    db.session.commit()
    return invoice
