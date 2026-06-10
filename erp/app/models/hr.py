import datetime
import json
from ..extensions import db


class EmployeeStatus:
    ACTIVE = 'ACTIVE'
    ON_LEAVE = 'ON_LEAVE'
    TERMINATED = 'TERMINATED'
    LABELS = {'ACTIVE': 'نشط', 'ON_LEAVE': 'في إجازة', 'TERMINATED': 'منهي الخدمة'}


class ContractType:
    FULL_TIME = 'FULL_TIME'
    PART_TIME = 'PART_TIME'
    LABELS = {'FULL_TIME': 'دوام كامل', 'PART_TIME': 'دوام جزئي'}


class LeaveType:
    ANNUAL = 'ANNUAL'
    SICK = 'SICK'
    EMERGENCY = 'EMERGENCY'
    UNPAID = 'UNPAID'
    LABELS = {'ANNUAL': 'سنوية', 'SICK': 'مرضية', 'EMERGENCY': 'طارئة', 'UNPAID': 'بدون راتب'}


class LeaveStatus:
    PENDING = 'PENDING'
    APPROVED = 'APPROVED'
    REJECTED = 'REJECTED'
    LABELS = {'PENDING': 'معلقة', 'APPROVED': 'معتمدة', 'REJECTED': 'مرفوضة'}


class AttendanceStatus:
    PRESENT = 'PRESENT'
    ABSENT = 'ABSENT'
    LATE = 'LATE'
    HALF_DAY = 'HALF_DAY'
    LABELS = {
        'PRESENT': 'حاضر', 'ABSENT': 'غائب',
        'LATE': 'متأخر', 'HALF_DAY': 'نصف يوم'
    }


class Employee(db.Model):
    __tablename__ = 'employees'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    nat_id = db.Column(db.String(20), unique=True, nullable=True)  # national ID
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=True)
    dept_id = db.Column(db.Integer, db.ForeignKey('departments.id'), nullable=True)
    position = db.Column(db.String(100))
    email = db.Column(db.String(120))
    phone = db.Column(db.String(30))
    hire_date = db.Column(db.Date, nullable=True)
    status = db.Column(db.String(20), default=EmployeeStatus.ACTIVE)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    branch = db.relationship('Branch', backref='employees')
    dept = db.relationship('Department', backref='employees')
    user = db.relationship('User', backref='employee', uselist=False)
    contracts = db.relationship('Contract', backref='employee', lazy='dynamic')
    attendances = db.relationship('Attendance', backref='employee', lazy='dynamic')
    leaves = db.relationship('Leave', backref='employee', lazy='dynamic')
    salary_payments = db.relationship('SalaryPayment', backref='employee', lazy='dynamic')
    advances = db.relationship('Advance', backref='employee', lazy='dynamic')

    def active_contract(self):
        return self.contracts.filter_by(is_active=True).first()

    def status_label(self):
        return EmployeeStatus.LABELS.get(self.status, self.status)


class Contract(db.Model):
    __tablename__ = 'contracts'
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False)
    type = db.Column(db.String(20), default=ContractType.FULL_TIME)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=True)
    basic_salary = db.Column(db.Numeric(15, 3), nullable=False)
    allowances = db.Column(db.Text, default='{}')  # JSON: {"housing": 500, "transport": 200}
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def get_allowances(self):
        try:
            return json.loads(self.allowances or '{}')
        except (json.JSONDecodeError, TypeError):
            return {}

    def total_allowances(self):
        return sum(self.get_allowances().values())

    def gross_salary(self):
        return float(self.basic_salary) + self.total_allowances()


class Attendance(db.Model):
    __tablename__ = 'attendances'
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    check_in = db.Column(db.Time, nullable=True)
    check_out = db.Column(db.Time, nullable=True)
    status = db.Column(db.String(20), default=AttendanceStatus.PRESENT)

    __table_args__ = (
        db.UniqueConstraint('employee_id', 'date', name='uq_attendance_emp_date'),
    )


class Leave(db.Model):
    __tablename__ = 'leaves'
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False)
    type = db.Column(db.String(20), nullable=False, default=LeaveType.ANNUAL)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    reason = db.Column(db.String(500))
    status = db.Column(db.String(20), default=LeaveStatus.PENDING)
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)

    approver = db.relationship('User', foreign_keys=[approved_by])

    def days_count(self):
        if self.start_date and self.end_date:
            return (self.end_date - self.start_date).days + 1
        return 0

    def status_label(self):
        return LeaveStatus.LABELS.get(self.status, self.status)

    def type_label(self):
        return LeaveType.LABELS.get(self.type, self.type)


class SalaryPayment(db.Model):
    __tablename__ = 'salary_payments'
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False)
    period = db.Column(db.String(7), nullable=False)  # YYYY-MM
    basic = db.Column(db.Numeric(15, 3), default=0)
    allowances = db.Column(db.Numeric(15, 3), default=0)
    overtime = db.Column(db.Numeric(15, 3), default=0)
    deductions = db.Column(db.Numeric(15, 3), default=0)
    advance_deduction = db.Column(db.Numeric(15, 3), default=0)
    net_salary = db.Column(db.Numeric(15, 3), default=0)
    journal_id = db.Column(db.Integer, db.ForeignKey('journal_entries.id'), nullable=True)
    paid_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('employee_id', 'period', name='uq_salary_emp_period'),
    )


class Advance(db.Model):
    __tablename__ = 'advances'
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False)
    amount = db.Column(db.Numeric(15, 3), nullable=False)
    date = db.Column(db.Date, nullable=False)
    repaid_amount = db.Column(db.Numeric(15, 3), default=0)
    monthly_deduction = db.Column(db.Numeric(15, 3), default=0)
    journal_id = db.Column(db.Integer, db.ForeignKey('journal_entries.id'), nullable=True)
    notes = db.Column(db.String(500))

    def outstanding_balance(self):
        return float(self.amount) - float(self.repaid_amount)
