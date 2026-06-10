import pytest
from datetime import date


def test_coa_page_loads(logged_in_client):
    rv = logged_in_client.get('/accounting/coa')
    assert rv.status_code == 200
    assert 'شجرة الحسابات' in rv.data.decode('utf-8')


def test_add_account(app, logged_in_client):
    rv = logged_in_client.post('/accounting/accounts/add', data={
        'code': 'T999',
        'name_ar': 'حساب اختبار',
        'name_en': 'Test Account',
        'type': 'ASSET',
        'normal_balance': 'DEBIT',
        'parent_id': '',
    }, follow_redirects=True)
    assert rv.status_code == 200
    with app.app_context():
        from app.models import Account
        acc = Account.query.filter_by(code='T999').first()
        assert acc is not None
        assert acc.name_ar == 'حساب اختبار'
        assert acc.is_leaf is True
        # cleanup
        from app.extensions import db
        db.session.delete(acc)
        db.session.commit()


def test_add_duplicate_account_rejected(app, logged_in_client):
    """Adding an account with an existing code should fail with a flash error."""
    from app.extensions import db
    from app.models import Account
    with app.app_context():
        existing = Account(code='DUPTEST', name_ar='مكرر', type='ASSET',
                           is_leaf=True, normal_balance='DEBIT')
        db.session.add(existing)
        db.session.commit()
    rv = logged_in_client.post('/accounting/accounts/add', data={
        'code': 'DUPTEST', 'name_ar': 'مكرر ثاني', 'type': 'ASSET',
        'normal_balance': 'DEBIT', 'parent_id': '',
    }, follow_redirects=True)
    assert 'مستخدم مسبقاً' in rv.data.decode('utf-8')
    with app.app_context():
        db.session.query(Account).filter_by(code='DUPTEST').delete()
        db.session.commit()


def test_journal_unbalanced_rejected(logged_in_client):
    rv = logged_in_client.post('/accounting/journal/new', data={
        'date': '2026-01-15',
        'description': 'قيد اختبار',
        'lines-0-account_id': '1',
        'lines-0-debit': '1000',
        'lines-0-credit': '0',
        'lines-1-account_id': '2',
        'lines-1-debit': '0',
        'lines-1-credit': '900',
    }, follow_redirects=True)
    assert 'غير متوازن' in rv.data.decode('utf-8')


def test_journal_balanced_saved(app, logged_in_client):
    """A balanced journal entry must be saved successfully."""
    with app.app_context():
        from app.models import Account
        from app.extensions import db
        a1 = Account(code='JT01', name_ar='حساب أول', type='ASSET',
                     is_leaf=True, normal_balance='DEBIT')
        a2 = Account(code='JT02', name_ar='حساب ثاني', type='LIABILITY',
                     is_leaf=True, normal_balance='CREDIT')
        db.session.add_all([a1, a2])
        db.session.commit()
        a1_id, a2_id = a1.id, a2.id

    rv = logged_in_client.post('/accounting/journal/new', data={
        'date': '2026-01-15',
        'description': 'قيد اختبار متوازن',
        'lines-0-account_id': str(a1_id),
        'lines-0-debit': '500',
        'lines-0-credit': '0',
        'lines-1-account_id': str(a2_id),
        'lines-1-debit': '0',
        'lines-1-credit': '500',
    }, follow_redirects=True)
    assert rv.status_code == 200
    assert 'تم حفظ القيد' in rv.data.decode('utf-8')

    with app.app_context():
        from app.models import JournalEntry, Account
        from app.extensions import db
        entry = JournalEntry.query.filter_by(description='قيد اختبار متوازن').first()
        assert entry is not None
        assert entry.is_balanced()
        # cleanup
        db.session.delete(entry)
        db.session.query(Account).filter(Account.id.in_([a1_id, a2_id])).delete(synchronize_session=False)
        db.session.commit()


def test_coa_seed_data(app):
    """COA seed produces at least 40 accounts with correct types."""
    with app.app_context():
        from app.extensions import db
        from app.models import Account
        from seed.coa_seed import seed_coa
        # only seed if empty (test isolation)
        if Account.query.count() == 0:
            seed_coa(db, Account)
        count = Account.query.count()
        assert count >= 40
        assets = Account.query.filter_by(type='ASSET').count()
        assert assets >= 5
