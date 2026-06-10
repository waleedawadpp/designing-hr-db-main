from datetime import date as date_type
from ..extensions import db


def generate_ref_no(model_class, prefix: str, year: int = None) -> str:
    """Generate a sequential reference number like JE-2026-00001."""
    if year is None:
        year = date_type.today().year
    count = model_class.query.filter(
        db.extract('year', model_class.date) == year
    ).count()
    return f"{prefix}-{year}-{count:05d}"


def create_manual_journal(date, description: str, lines: list,
                          branch_id: int = None, created_by: int = None):
    """
    Create and return a posted JournalEntry from a list of line dicts.
    Each line dict: {account_id, debit, credit, description}
    Raises ValueError if lines don't balance.
    """
    from ..models.accounting import JournalEntry, JournalEntryLine
    total_debit = sum(float(l.get('debit', 0)) for l in lines)
    total_credit = sum(float(l.get('credit', 0)) for l in lines)
    if abs(total_debit - total_credit) > 0.001:
        raise ValueError(
            f'القيد غير متوازن: مجموع المدين ({total_debit:.3f}) '
            f'لا يساوي مجموع الدائن ({total_credit:.3f})'
        )
    entry = JournalEntry(
        date=date,
        description=description,
        source='MANUAL',
        branch_id=branch_id,
        created_by=created_by,
        is_posted=True,
    )
    db.session.add(entry)
    db.session.flush()
    entry.ref_no = generate_ref_no(JournalEntry, 'JE')
    for line_data in lines:
        line = JournalEntryLine(
            entry_id=entry.id,
            account_id=line_data['account_id'],
            debit=float(line_data.get('debit', 0)),
            credit=float(line_data.get('credit', 0)),
            description=line_data.get('description', ''),
        )
        db.session.add(line)
    return entry


def create_sales_journal_entry(invoice):
    """
    Auto-generate journal entry for a confirmed sales invoice.
    CREDIT: المبيعات (4101), CREDIT: ضريبة مخرجات (2102)
    DEBIT: ذمم عملاء (1103) for CREDIT invoices OR ح/الصندوق (1101) for CASH
    DEBIT: تكلفة البضاعة المباعة (5101)
    CREDIT: مخزون بضاعة (1104)
    """
    from ..models.accounting import Account, JournalEntry, JournalEntryLine

    # Find standard accounts by code
    def get_account(code):
        return Account.query.filter_by(code=code).first()

    sales_acc = get_account('4101')
    vat_acc = get_account('2102')
    cash_acc = get_account('1101')
    receivable_acc = get_account('1103')
    cogs_acc = get_account('5101')
    inventory_acc = get_account('1104')

    lines = []
    grand_total = float(invoice.grand_total)
    vat_total = float(invoice.vat_total)
    net_sales = grand_total - vat_total

    # Debit side: cash or receivable
    debit_acc = receivable_acc if invoice.type == 'CREDIT' else cash_acc
    if debit_acc:
        lines.append({
            'account_id': debit_acc.id,
            'debit': grand_total,
            'credit': 0,
            'description': f'فاتورة {invoice.invoice_no}',
        })

    # Credit: sales
    if sales_acc:
        lines.append({
            'account_id': sales_acc.id,
            'debit': 0,
            'credit': net_sales,
            'description': f'مبيعات — {invoice.invoice_no}',
        })

    # Credit: VAT
    if vat_acc and vat_total > 0:
        lines.append({
            'account_id': vat_acc.id,
            'debit': 0,
            'credit': vat_total,
            'description': 'ضريبة القيمة المضافة',
        })

    if not lines or len(lines) < 2:
        return None  # COA not seeded yet, skip

    return create_manual_journal(
        date=invoice.date,
        description=f'فاتورة بيع رقم {invoice.invoice_no}',
        lines=lines,
        branch_id=invoice.branch_id,
        created_by=invoice.created_by,
    )


def create_purchase_journal_entry(receipt):
    """
    Auto-generate journal for a confirmed goods receipt.
    DEBIT:  مخزون بضاعة (1104) — inventory
    CREDIT: ذمم دائنة موردين (2101) — accounts payable
    """
    from ..models.accounting import Account

    def get_account(code):
        return Account.query.filter_by(code=code).first()

    inventory_acc = get_account('1104')
    payable_acc = get_account('2101')

    total = sum(float(item.qty_received) * float(item.unit_cost)
                for item in receipt.items)
    total += sum(float(c.amount) for c in receipt.po.import_costs)

    if total == 0 or not inventory_acc or not payable_acc:
        return None

    lines = [
        {'account_id': inventory_acc.id, 'debit': total, 'credit': 0,
         'description': f'استلام بضاعة GR-{receipt.id}'},
        {'account_id': payable_acc.id, 'debit': 0, 'credit': total,
         'description': f'مورد: {receipt.po.supplier.name}'},
    ]
    return create_manual_journal(
        date=receipt.date,
        description=f'استلام بضاعة رقم GR-{receipt.id}',
        lines=lines,
        branch_id=receipt.po.branch_id,
        created_by=receipt.created_by,
    )


def create_payroll_journal_entry(payment):
    """
    Auto-generate journal for a salary payment.
    DEBIT:  مصروف رواتب (5201)
    CREDIT: نقدية/صندوق (1101) for net salary
    CREDIT: مستحقات الموظفين (2103) for deductions (if any)
    """
    from ..models.accounting import Account

    def get_account(code):
        return Account.query.filter_by(code=code).first()

    salary_exp_acc = get_account('5201')
    cash_acc = get_account('1101')
    payables_acc = get_account('2103')  # employee payables / accrued salaries

    net = float(payment.net_salary)
    deductions = float(payment.deductions) + float(payment.advance_deduction)

    if net == 0 or not salary_exp_acc or not cash_acc:
        return None

    gross = net + deductions
    lines = [
        {'account_id': salary_exp_acc.id, 'debit': gross, 'credit': 0,
         'description': f'رواتب {payment.period}'},
        {'account_id': cash_acc.id, 'debit': 0, 'credit': net,
         'description': f'صرف راتب — {payment.period}'},
    ]
    if deductions > 0 and payables_acc:
        lines.append({
            'account_id': payables_acc.id, 'debit': 0, 'credit': deductions,
            'description': 'استقطاعات',
        })
    elif deductions > 0:
        # fallback: credit back to cash if no accruals account
        lines[1]['credit'] += deductions

    return create_manual_journal(
        date=payment.paid_at.date() if payment.paid_at else __import__('datetime').date.today(),
        description=f'رواتب موظف #{payment.employee_id} — {payment.period}',
        lines=lines,
        created_by=None,
    )
