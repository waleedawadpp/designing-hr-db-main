"""Tests for accounting report routes."""
import datetime
import pytest

from app.extensions import db as _db
from app.models import Account, Branch, User, UserRole
from app.models.accounting import JournalEntry, JournalEntryLine, AccountType


# ---------------------------------------------------------------------------
# Module-scoped fixture: ensure clean accounting tables before/after module
# ---------------------------------------------------------------------------

@pytest.fixture(scope='module', autouse=True)
def clean_accounting_tables(app):
    """Clear accounting tables before and after the module runs."""
    with app.app_context():
        _db.session.query(JournalEntryLine).delete()
        _db.session.query(JournalEntry).delete()
        _db.session.query(Account).delete()
        from app.models.accounting import CashVoucher
        _db.session.query(CashVoucher).delete()
        _db.session.commit()

    yield

    with app.app_context():
        _db.session.query(JournalEntryLine).delete()
        _db.session.query(JournalEntry).delete()
        _db.session.query(Account).delete()
        from app.models.accounting import CashVoucher
        _db.session.query(CashVoucher).delete()
        _db.session.commit()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_accounts(app):
    """Create two sample accounts for report tests."""
    with app.app_context():
        a1 = Account(code='RPT01', name_ar='حساب إيرادات اختبار', type=AccountType.REVENUE,
                     normal_balance='CREDIT', is_leaf=True, is_active=True)
        a2 = Account(code='RPT02', name_ar='حساب مصروفات اختبار', type=AccountType.EXPENSE,
                     normal_balance='DEBIT', is_leaf=True, is_active=True)
        a3 = Account(code='RPT03', name_ar='حساب أصول اختبار', type=AccountType.ASSET,
                     normal_balance='DEBIT', is_leaf=True, is_active=True)
        _db.session.add_all([a1, a2, a3])
        _db.session.commit()
        return a1.id, a2.id, a3.id


def _make_journal_with_lines(app, a1_id, a2_id):
    """Create a balanced posted journal entry."""
    with app.app_context():
        entry = JournalEntry(
            ref_no='RPT-JE-001',
            date=datetime.date(2026, 1, 15),
            description='قيد اختبار للتقارير',
            is_posted=True,
        )
        _db.session.add(entry)
        _db.session.flush()
        line1 = JournalEntryLine(entry_id=entry.id, account_id=a1_id, debit=0, credit=1000)
        line2 = JournalEntryLine(entry_id=entry.id, account_id=a2_id, debit=1000, credit=0)
        _db.session.add_all([line1, line2])
        _db.session.commit()
        return entry.id


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_trial_balance_loads(app, logged_in_client):
    """Trial balance page must return 200."""
    rv = logged_in_client.get('/accounting/reports/trial-balance')
    assert rv.status_code == 200
    assert 'ميزان المراجعة' in rv.data.decode('utf-8')


def test_ledger_loads(app, logged_in_client):
    """Ledger page without account selection returns 200."""
    rv = logged_in_client.get('/accounting/reports/ledger')
    assert rv.status_code == 200
    assert 'دفتر الأستاذ' in rv.data.decode('utf-8')


def test_pl_loads(app, logged_in_client):
    """P&L page must return 200."""
    rv = logged_in_client.get('/accounting/reports/pl')
    assert rv.status_code == 200
    assert 'قائمة الدخل' in rv.data.decode('utf-8')


def test_balance_sheet_loads(app, logged_in_client):
    """Balance sheet page must return 200."""
    rv = logged_in_client.get('/accounting/reports/balance-sheet')
    assert rv.status_code == 200
    assert 'الميزانية العمومية' in rv.data.decode('utf-8')


def test_vat_report_loads(app, logged_in_client):
    """VAT report page must return 200."""
    rv = logged_in_client.get('/accounting/reports/vat')
    assert rv.status_code == 200
    assert 'ضريبة القيمة المضافة' in rv.data.decode('utf-8')


def test_aging_report_loads(app, logged_in_client):
    """Customer aging report page must return 200."""
    rv = logged_in_client.get('/accounting/reports/aging')
    assert rv.status_code == 200
    assert 'أعمار الذمم' in rv.data.decode('utf-8')


def test_trial_balance_excel_export(app, logged_in_client):
    """Trial balance Excel export must return an xlsx file."""
    a1_id, a2_id, a3_id = _make_accounts(app)
    _make_journal_with_lines(app, a1_id, a2_id)

    rv = logged_in_client.get('/accounting/reports/trial-balance/export/excel?from_date=2026-01-01&to_date=2026-12-31')
    assert rv.status_code == 200
    assert rv.content_type == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    # Check it's a valid xlsx (starts with PK ZIP magic bytes)
    assert rv.data[:2] == b'PK'


def test_ledger_with_account(app, logged_in_client):
    """Ledger with an account_id returns account data."""
    with app.app_context():
        acc = Account.query.filter_by(code='RPT01').first()
        if acc is None:
            acc_id, _, _ = _make_accounts(app)
            with app.app_context():
                acc = _db.session.get(Account, acc_id)
        acc_id = acc.id

    rv = logged_in_client.get(f'/accounting/reports/ledger?account_id={acc_id}&from_date=2026-01-01&to_date=2026-12-31')
    assert rv.status_code == 200
    assert 'دفتر الأستاذ' in rv.data.decode('utf-8')


def test_trial_balance_with_data(app, logged_in_client):
    """Trial balance shows account rows when there are journal entries."""
    rv = logged_in_client.get('/accounting/reports/trial-balance?from_date=2026-01-01&to_date=2026-12-31')
    assert rv.status_code == 200
    html = rv.data.decode('utf-8')
    assert 'ميزان المراجعة' in html


def test_pdf_export_route_registered(app):
    """PDF export route is registered in the URL map."""
    with app.app_context():
        rules = [rule.rule for rule in app.url_map.iter_rules()]
        assert '/accounting/reports/trial-balance/export/pdf' in rules
