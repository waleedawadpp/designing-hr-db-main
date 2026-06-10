import logging
from flask import render_template, redirect, url_for, flash, request
from flask_login import login_required, current_user

from . import hr_bp
from .forms import (EmployeeForm, ContractForm, AttendanceForm,
                     LeaveForm, SalaryPaymentForm, AdvanceForm)
from ...models import (Employee, Contract, Attendance, Leave,
                       SalaryPayment, Advance, EmployeeStatus, LeaveStatus)
from ...extensions import db
from ...services.hr_service import create_salary_payment

logger = logging.getLogger(__name__)


# ── Employees ────────────────────────────────────────────────────────────────

@hr_bp.route('/employees/')
@login_required
def employees():
    from sqlalchemy.orm import joinedload
    emps = (Employee.query
            .options(joinedload(Employee.dept))
            .order_by(Employee.name)
            .all())
    return render_template('hr/employees/index.html', employees=emps)


@hr_bp.route('/employees/new', methods=['GET', 'POST'])
@login_required
def new_employee():
    from ...models.core import Branch, Department
    form = EmployeeForm()
    form.branch_id.choices = [(0, '— اختر فرعاً —')] + [(b.id, b.name) for b in Branch.query.filter_by(is_active=True).all()]
    form.dept_id.choices = [(0, '— اختر قسماً —')] + [(d.id, d.name) for d in Department.query.all()]
    if form.validate_on_submit():
        emp = Employee(
            name=form.name.data, nat_id=form.nat_id.data or None,
            branch_id=form.branch_id.data or None,
            dept_id=form.dept_id.data or None,
            position=form.position.data, email=form.email.data,
            phone=form.phone.data, hire_date=form.hire_date.data,
            status=form.status.data,
        )
        db.session.add(emp)
        db.session.commit()
        flash('تم إضافة الموظف', 'success')
        return redirect(url_for('hr.employee_detail', id=emp.id))
    return render_template('hr/employees/form.html', form=form, title='إضافة موظف')


@hr_bp.route('/employees/<int:id>')
@login_required
def employee_detail(id):
    emp = db.session.get(Employee, id)
    if not emp:
        flash('الموظف غير موجود', 'danger')
        return redirect(url_for('hr.employees'))
    contract_form = ContractForm()
    leave_form = LeaveForm()
    advance_form = AdvanceForm()
    salary_form = SalaryPaymentForm()
    return render_template('hr/employees/detail.html',
                           emp=emp, contract_form=contract_form,
                           leave_form=leave_form, advance_form=advance_form,
                           salary_form=salary_form)


@hr_bp.route('/employees/<int:id>/edit', methods=['GET', 'POST'])
@login_required
def edit_employee(id):
    from ...models.core import Branch, Department
    emp = db.session.get(Employee, id)
    if not emp:
        flash('الموظف غير موجود', 'danger')
        return redirect(url_for('hr.employees'))
    form = EmployeeForm(obj=emp)
    form.branch_id.choices = [(0, '— اختر —')] + [(b.id, b.name) for b in Branch.query.filter_by(is_active=True).all()]
    form.dept_id.choices = [(0, '— اختر —')] + [(d.id, d.name) for d in Department.query.all()]
    if form.validate_on_submit():
        emp.name = form.name.data
        emp.nat_id = form.nat_id.data or None
        emp.branch_id = form.branch_id.data or None
        emp.dept_id = form.dept_id.data or None
        emp.position = form.position.data
        emp.email = form.email.data
        emp.phone = form.phone.data
        emp.hire_date = form.hire_date.data
        emp.status = form.status.data
        db.session.commit()
        flash('تم تحديث بيانات الموظف', 'success')
        return redirect(url_for('hr.employee_detail', id=id))
    return render_template('hr/employees/form.html', form=form, title='تعديل موظف')


# ── Contracts ────────────────────────────────────────────────────────────────

@hr_bp.route('/employees/<int:emp_id>/contracts/new', methods=['POST'])
@login_required
def new_contract(emp_id):
    import json
    form = ContractForm()
    if form.validate_on_submit():
        # Deactivate existing contracts
        Contract.query.filter_by(employee_id=emp_id, is_active=True).update({'is_active': False})
        allowances = {}
        if form.housing_allowance.data:
            allowances['housing'] = float(form.housing_allowance.data)
        if form.transport_allowance.data:
            allowances['transport'] = float(form.transport_allowance.data)
        contract = Contract(
            employee_id=emp_id,
            type=form.type.data,
            start_date=form.start_date.data,
            end_date=form.end_date.data,
            basic_salary=form.basic_salary.data,
            allowances=json.dumps(allowances),
            is_active=True,
        )
        db.session.add(contract)
        db.session.commit()
        flash('تم إضافة العقد', 'success')
    return redirect(url_for('hr.employee_detail', id=emp_id))


# ── Attendance ────────────────────────────────────────────────────────────────

@hr_bp.route('/attendance/')
@login_required
def attendance_list():
    from datetime import date
    today = date.today()
    records = Attendance.query.filter_by(date=today).all()
    employees = Employee.query.filter_by(status=EmployeeStatus.ACTIVE).order_by(Employee.name).all()
    return render_template('hr/attendance/index.html',
                           records=records, employees=employees, today=today)


@hr_bp.route('/attendance/record', methods=['POST'])
@login_required
def record_attendance():
    from datetime import date as date_type
    employee_ids = request.form.getlist('employee_id[]')
    statuses = request.form.getlist('status[]')
    att_date_str = request.form.get('date', str(date_type.today()))
    try:
        from datetime import date as dt
        att_date = dt.fromisoformat(att_date_str)
    except ValueError:
        att_date = date_type.today()

    for emp_id_str, status in zip(employee_ids, statuses):
        try:
            emp_id = int(emp_id_str)
            existing = Attendance.query.filter_by(employee_id=emp_id, date=att_date).first()
            if existing:
                existing.status = status
            else:
                att = Attendance(employee_id=emp_id, date=att_date, status=status)
                db.session.add(att)
        except (ValueError, TypeError):
            pass
    db.session.commit()
    flash('تم تسجيل الحضور', 'success')
    return redirect(url_for('hr.attendance_list'))


# ── Leaves ────────────────────────────────────────────────────────────────────

@hr_bp.route('/leaves/')
@login_required
def leaves():
    all_leaves = Leave.query.order_by(Leave.start_date.desc()).all()
    return render_template('hr/leaves/index.html', leaves=all_leaves)


@hr_bp.route('/employees/<int:emp_id>/leaves/new', methods=['POST'])
@login_required
def new_leave(emp_id):
    form = LeaveForm()
    if form.validate_on_submit():
        leave = Leave(
            employee_id=emp_id,
            type=form.type.data,
            start_date=form.start_date.data,
            end_date=form.end_date.data,
            reason=form.reason.data,
            status=LeaveStatus.PENDING,
        )
        db.session.add(leave)
        db.session.commit()
        flash('تم تقديم طلب الإجازة', 'success')
    return redirect(url_for('hr.employee_detail', id=emp_id))


@hr_bp.route('/leaves/<int:id>/approve', methods=['POST'])
@login_required
def approve_leave(id):
    import datetime as dt
    leave = db.session.get(Leave, id)
    if leave and leave.status == LeaveStatus.PENDING:
        leave.status = LeaveStatus.APPROVED
        leave.approved_by = current_user.id
        leave.approved_at = dt.datetime.utcnow()
        db.session.commit()
        flash('تم اعتماد الإجازة', 'success')
    return redirect(url_for('hr.leaves'))


@hr_bp.route('/leaves/<int:id>/reject', methods=['POST'])
@login_required
def reject_leave(id):
    leave = db.session.get(Leave, id)
    if leave and leave.status == LeaveStatus.PENDING:
        leave.status = LeaveStatus.REJECTED
        leave.approved_by = current_user.id
        db.session.commit()
        flash('تم رفض الإجازة', 'danger')
    return redirect(url_for('hr.leaves'))


# ── Salary Payments ───────────────────────────────────────────────────────────

@hr_bp.route('/salary/')
@login_required
def salary_list():
    from sqlalchemy.orm import joinedload
    payments = (SalaryPayment.query
                .options(joinedload(SalaryPayment.employee))
                .order_by(SalaryPayment.period.desc())
                .all())
    return render_template('hr/salary/index.html', payments=payments)


@hr_bp.route('/employees/<int:emp_id>/salary/new', methods=['POST'])
@login_required
def new_salary_payment(emp_id):
    form = SalaryPaymentForm()
    if form.validate_on_submit():
        try:
            create_salary_payment(
                employee_id=emp_id,
                period=form.period.data,
                overtime=float(form.overtime.data or 0),
                extra_deductions=float(form.extra_deductions.data or 0),
                created_by=current_user.id,
            )
            flash('تم صرف الراتب وتسجيل القيد', 'success')
        except ValueError as e:
            flash(str(e), 'danger')
    return redirect(url_for('hr.employee_detail', id=emp_id))


# ── Advances ──────────────────────────────────────────────────────────────────

@hr_bp.route('/employees/<int:emp_id>/advances/new', methods=['POST'])
@login_required
def new_advance(emp_id):
    form = AdvanceForm()
    if form.validate_on_submit():
        advance = Advance(
            employee_id=emp_id,
            amount=form.amount.data,
            date=form.date.data,
            monthly_deduction=form.monthly_deduction.data or 0,
            notes=form.notes.data,
        )
        db.session.add(advance)
        db.session.commit()
        flash('تم تسجيل السلفة', 'success')
    return redirect(url_for('hr.employee_detail', id=emp_id))
