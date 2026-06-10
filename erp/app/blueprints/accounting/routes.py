from functools import wraps

from flask import render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_required, current_user

from . import accounting_bp
from .forms import AccountForm, JournalEntryForm
from ...extensions import db
from ...models import Account, AccountType, JournalEntry, JournalEntryLine
from ...services.accounting_service import create_manual_journal


def accountant_required(f):
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        from ...models import UserRole
        allowed = [UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT]
        if current_user.role not in allowed:
            flash('ليس لديك صلاحية الوصول لهذه الصفحة', 'danger')
            return redirect(url_for('dashboard.index'))
        return f(*args, **kwargs)
    return decorated


@accounting_bp.route('/coa')
@login_required
def coa():
    roots = Account.query.filter_by(parent_id=None).order_by(Account.code).all()
    return render_template('accounting/coa.html', roots=roots, AccountType=AccountType)


@accounting_bp.route('/accounts/add', methods=['GET', 'POST'])
@accountant_required
def add_account():
    form = AccountForm()
    parent_choices = [('', '— حساب رئيسي —')] + [
        (str(a.id), f"{a.code} — {a.name_ar}")
        for a in Account.query.order_by(Account.code).all()
    ]
    form.parent_id.choices = parent_choices

    if form.validate_on_submit():
        if Account.query.filter_by(code=form.code.data).first():
            flash(f'كود الحساب {form.code.data} مستخدم مسبقاً', 'danger')
            return render_template('accounting/account_form.html', form=form, title='إضافة حساب')

        parent_id = form.parent_id.data if form.parent_id.data else None
        parent = db.session.get(Account, int(parent_id)) if parent_id else None
        if parent:
            parent.is_leaf = False

        acc = Account(
            code=form.code.data,
            name_ar=form.name_ar.data,
            name_en=form.name_en.data or None,
            type=form.type.data,
            parent_id=int(parent_id) if parent_id else None,
            level=(parent.level + 1) if parent else 1,
            normal_balance=form.normal_balance.data,
            is_leaf=True,
        )
        db.session.add(acc)
        db.session.commit()
        flash(f'تم إضافة الحساب "{acc.name_ar}" بنجاح', 'success')
        return redirect(url_for('accounting.coa'))

    return render_template('accounting/account_form.html', form=form, title='إضافة حساب')


@accounting_bp.route('/accounts/<int:account_id>/edit', methods=['GET', 'POST'])
@accountant_required
def edit_account(account_id):
    acc = db.session.get(Account, account_id)
    if not acc:
        flash('الحساب غير موجود', 'danger')
        return redirect(url_for('accounting.coa'))

    form = AccountForm(obj=acc)
    form.parent_id.choices = [('', '— حساب رئيسي —')] + [
        (str(a.id), f"{a.code} — {a.name_ar}")
        for a in Account.query.filter(Account.id != account_id).order_by(Account.code).all()
    ]

    if form.validate_on_submit():
        acc.name_ar = form.name_ar.data
        acc.name_en = form.name_en.data or None
        acc.normal_balance = form.normal_balance.data
        db.session.commit()
        flash('تم تعديل الحساب بنجاح', 'success')
        return redirect(url_for('accounting.coa'))

    if acc.parent_id:
        form.parent_id.data = str(acc.parent_id)

    return render_template('accounting/account_form.html', form=form, title='تعديل حساب')


@accounting_bp.route('/journal')
@login_required
def journal_list():
    entries = JournalEntry.query.order_by(JournalEntry.date.desc(), JournalEntry.id.desc()).limit(100).all()
    return render_template('accounting/journal_list.html', entries=entries)


@accounting_bp.route('/journal/new', methods=['GET', 'POST'])
@accountant_required
def new_journal():
    form = JournalEntryForm()
    accounts = Account.query.filter_by(is_leaf=True, is_active=True).order_by(Account.code).all()

    if request.method == 'POST':
        lines_data = _parse_journal_lines(request.form)
        if not lines_data:
            flash('يجب إضافة سطر واحد على الأقل', 'danger')
            return render_template('accounting/journal_form.html', form=form, accounts=accounts)

        total_debit = sum(l['debit'] for l in lines_data)
        total_credit = sum(l['credit'] for l in lines_data)
        if abs(total_debit - total_credit) > 0.001:
            flash(
                f'القيد غير متوازن: المدين ({total_debit:.3f}) ≠ الدائن ({total_credit:.3f})',
                'danger'
            )
            return render_template('accounting/journal_form.html', form=form, accounts=accounts)

        if not form.date.data:
            flash('التاريخ مطلوب', 'danger')
            return render_template('accounting/journal_form.html', form=form, accounts=accounts)

        try:
            entry = create_manual_journal(
                date=form.date.data,
                description=form.description.data,
                lines=lines_data,
                branch_id=current_user.branch_id,
                created_by=current_user.id,
            )
            db.session.commit()
            flash(f'تم حفظ القيد رقم {entry.ref_no} بنجاح', 'success')
            return redirect(url_for('accounting.journal_list'))
        except ValueError as e:
            flash(str(e), 'danger')

    return render_template('accounting/journal_form.html', form=form, accounts=accounts)


def _parse_journal_lines(form_data):
    lines = []
    i = 0
    while f'lines-{i}-account_id' in form_data:
        acc_id = form_data.get(f'lines-{i}-account_id', '').strip()
        debit = float(form_data.get(f'lines-{i}-debit') or 0)
        credit = float(form_data.get(f'lines-{i}-credit') or 0)
        desc = form_data.get(f'lines-{i}-description', '')
        if acc_id and (debit or credit):
            lines.append({
                'account_id': int(acc_id),
                'debit': debit,
                'credit': credit,
                'description': desc,
            })
        i += 1
    return lines
