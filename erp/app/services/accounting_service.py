from datetime import date as date_type
from ..extensions import db


def generate_ref_no(model_class, prefix: str, year: int = None) -> str:
    """Generate a sequential reference number like JE-2026-00001."""
    if year is None:
        year = date_type.today().year
    count = model_class.query.filter(
        db.func.strftime('%Y', model_class.date) == str(year)
    ).count()
    return f"{prefix}-{year}-{count + 1:05d}"


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
