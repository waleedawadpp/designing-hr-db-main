from datetime import datetime
from ..extensions import db


class AccountType:
    ASSET = 'ASSET'
    LIABILITY = 'LIABILITY'
    EQUITY = 'EQUITY'
    REVENUE = 'REVENUE'
    EXPENSE = 'EXPENSE'
    LABELS = {
        'ASSET': 'أصول',
        'LIABILITY': 'خصوم',
        'EQUITY': 'حقوق ملكية',
        'REVENUE': 'إيرادات',
        'EXPENSE': 'مصروفات',
    }


class Account(db.Model):
    __tablename__ = 'accounts'
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(20), unique=True, nullable=False)
    name_ar = db.Column(db.String(150), nullable=False)
    name_en = db.Column(db.String(150))
    type = db.Column(db.String(20), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('accounts.id'))
    level = db.Column(db.Integer, default=1)
    is_leaf = db.Column(db.Boolean, default=True)
    normal_balance = db.Column(db.String(10), default='DEBIT')  # DEBIT or CREDIT
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=True)
    is_active = db.Column(db.Boolean, default=True)

    children = db.relationship(
        'Account',
        backref=db.backref('parent', remote_side=[id]),
        lazy='dynamic',
        foreign_keys=[parent_id],
        order_by='Account.code'
    )
    journal_lines = db.relationship('JournalEntryLine', backref='account', lazy='dynamic')

    def get_balance(self, branch_id=None, from_date=None, to_date=None):
        query = (
            JournalEntryLine.query
            .join(JournalEntry)
            .filter(
                JournalEntryLine.account_id == self.id,
                JournalEntry.is_posted == True
            )
        )
        if branch_id:
            query = query.filter(JournalEntry.branch_id == branch_id)
        if from_date:
            query = query.filter(JournalEntry.date >= from_date)
        if to_date:
            query = query.filter(JournalEntry.date <= to_date)
        result = query.with_entities(
            db.func.sum(JournalEntryLine.debit),
            db.func.sum(JournalEntryLine.credit)
        ).first()
        total_debit = float(result[0] or 0)
        total_credit = float(result[1] or 0)
        if self.normal_balance == 'DEBIT':
            return total_debit - total_credit
        return total_credit - total_debit

    def type_label(self):
        return AccountType.LABELS.get(self.type, self.type)


class FiscalPeriod(db.Model):
    __tablename__ = 'fiscal_periods'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    is_closed = db.Column(db.Boolean, default=False)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=True)


class JournalEntry(db.Model):
    __tablename__ = 'journal_entries'
    id = db.Column(db.Integer, primary_key=True)
    ref_no = db.Column(db.String(30), unique=True)
    date = db.Column(db.Date, nullable=False)
    description = db.Column(db.String(500))
    source = db.Column(db.String(30), default='MANUAL')
    source_ref_id = db.Column(db.Integer, nullable=True)
    period_id = db.Column(db.Integer, db.ForeignKey('fiscal_periods.id'), nullable=True)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=True)
    is_posted = db.Column(db.Boolean, default=False)
    is_reversed = db.Column(db.Boolean, default=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    lines = db.relationship(
        'JournalEntryLine',
        backref='entry',
        lazy='dynamic',
        cascade='all, delete-orphan'
    )

    def total_debit(self):
        return float(sum(float(l.debit or 0) for l in self.lines))

    def total_credit(self):
        return float(sum(float(l.credit or 0) for l in self.lines))

    def is_balanced(self):
        return abs(self.total_debit() - self.total_credit()) < 0.001


class JournalEntryLine(db.Model):
    __tablename__ = 'journal_entry_lines'
    id = db.Column(db.Integer, primary_key=True)
    entry_id = db.Column(db.Integer, db.ForeignKey('journal_entries.id'), nullable=False)
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=False)
    debit = db.Column(db.Numeric(15, 3), default=0)
    credit = db.Column(db.Numeric(15, 3), default=0)
    description = db.Column(db.String(255))


class CashVoucher(db.Model):
    __tablename__ = 'cash_vouchers'
    id = db.Column(db.Integer, primary_key=True)
    ref_no = db.Column(db.String(30), unique=True)
    type = db.Column(db.String(10), nullable=False)  # RECEIPT or PAYMENT
    date = db.Column(db.Date, nullable=False)
    amount = db.Column(db.Numeric(15, 3), nullable=False)
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)
    party_type = db.Column(db.String(20), nullable=True)  # CUSTOMER / SUPPLIER / EMPLOYEE / OTHER
    party_id = db.Column(db.Integer, nullable=True)
    description = db.Column(db.String(500))
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=True)
    journal_id = db.Column(db.Integer, db.ForeignKey('journal_entries.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Bank(db.Model):
    __tablename__ = 'banks'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    account_no = db.Column(db.String(50))
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=True)
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)
    current_balance = db.Column(db.Numeric(15, 3), default=0)
