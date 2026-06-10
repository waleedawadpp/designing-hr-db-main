import pytest
from datetime import date
from decimal import Decimal


@pytest.fixture(autouse=True, scope='module')
def clean_hr_tables(app):
    from app.models import (SalaryPayment, Advance, Leave, Attendance,
                              Contract, Employee)
    from app.extensions import db
    tables = [SalaryPayment, Advance, Leave, Attendance, Contract, Employee]
    with app.app_context():
        for model in tables:
            model.query.delete()
        db.session.commit()
    yield
    with app.app_context():
        for model in tables:
            model.query.delete()
        db.session.commit()


def _make_employee(app, db, name='موظف اختبار', nat_id=None):
    from app.models import Employee
    from app.models.core import Branch
    with app.app_context():
        branch = Branch.query.first()
        emp = Employee(name=name, nat_id=nat_id, branch_id=branch.id,
                       position='مستشار', status='ACTIVE')
        db.session.add(emp)
        db.session.commit()
        return emp.id


def test_employee_list(logged_in_client):
    rv = logged_in_client.get('/hr/employees/')
    assert rv.status_code == 200


def test_create_employee(app, logged_in_client, seed_user):
    rv = logged_in_client.post('/hr/employees/new', data={
        'name': 'موظف جديد', 'position': 'محاسب',
        'status': 'ACTIVE', 'csrf_token': '',
    }, follow_redirects=True)
    assert rv.status_code == 200
    from app.models import Employee
    with app.app_context():
        emp = Employee.query.filter_by(name='موظف جديد').first()
        assert emp is not None


def test_salary_calculation(app, seed_user):
    from app.models import Employee, Contract
    from app.services.hr_service import calculate_salary
    from app.extensions import db
    import json
    with app.app_context():
        from app.models.core import Branch
        branch = Branch.query.first()
        emp = Employee(name='موظف راتب', branch_id=branch.id, status='ACTIVE')
        db.session.add(emp)
        db.session.flush()
        contract = Contract(
            employee_id=emp.id, type='FULL_TIME',
            start_date=date(2026, 1, 1),
            basic_salary=Decimal('5000'),
            allowances=json.dumps({'housing': 1000, 'transport': 500}),
            is_active=True,
        )
        db.session.add(contract)
        db.session.commit()
        emp_id = emp.id

    with app.app_context():
        result = calculate_salary(emp_id, '2026-06')
        assert result['basic'] == 5000.0
        assert result['allowances'] == 1500.0
        assert result['net'] == 6500.0


def test_salary_prevents_double_payment(app, seed_user):
    from app.models import Employee, Contract
    from app.services.hr_service import create_salary_payment, calculate_salary
    from app.extensions import db
    import json, pytest
    with app.app_context():
        from app.models.core import Branch
        branch = Branch.query.first()
        emp = Employee(name='موظف مكرر', branch_id=branch.id, status='ACTIVE')
        db.session.add(emp)
        db.session.flush()
        contract = Contract(
            employee_id=emp.id, type='FULL_TIME',
            start_date=date(2026, 1, 1),
            basic_salary=Decimal('3000'),
            allowances='{}', is_active=True,
        )
        db.session.add(contract)
        db.session.commit()
        emp_id = emp.id

    with app.app_context():
        create_salary_payment(emp_id, '2026-07')
        with pytest.raises(ValueError, match='مسبقاً'):
            create_salary_payment(emp_id, '2026-07')


def test_advance_deduction(app, seed_user):
    from app.models import Employee, Contract, Advance
    from app.services.hr_service import calculate_salary
    from app.extensions import db
    import json
    with app.app_context():
        from app.models.core import Branch
        branch = Branch.query.first()
        emp = Employee(name='موظف سلفة', branch_id=branch.id, status='ACTIVE')
        db.session.add(emp)
        db.session.flush()
        contract = Contract(
            employee_id=emp.id, type='FULL_TIME',
            start_date=date(2026, 1, 1),
            basic_salary=Decimal('4000'),
            allowances='{}', is_active=True,
        )
        db.session.add(contract)
        db.session.flush()
        adv = Advance(
            employee_id=emp.id, amount=Decimal('1200'),
            date=date(2026, 5, 1),
            monthly_deduction=Decimal('400'),
            repaid_amount=Decimal('0'),
        )
        db.session.add(adv)
        db.session.commit()
        emp_id = emp.id

    with app.app_context():
        result = calculate_salary(emp_id, '2026-08')
        assert result['advance_deduction'] == 400.0
        assert result['net'] == 3600.0


def test_leave_approval_flow(app, seed_user):
    from app.models import Employee, Leave, LeaveStatus
    from app.extensions import db
    with app.app_context():
        from app.models.core import Branch
        branch = Branch.query.first()
        emp = Employee(name='موظف إجازة', branch_id=branch.id, status='ACTIVE')
        db.session.add(emp)
        db.session.flush()
        leave = Leave(
            employee_id=emp.id, type='ANNUAL',
            start_date=date(2026, 7, 1), end_date=date(2026, 7, 7),
            status=LeaveStatus.PENDING,
        )
        db.session.add(leave)
        db.session.commit()
        leave_id = leave.id

    with app.app_context():
        from app.models import Leave as L
        l = db.session.get(L, leave_id)
        l.status = LeaveStatus.APPROVED
        db.session.commit()
        assert db.session.get(L, leave_id).status == LeaveStatus.APPROVED


def test_leave_days_count(app, seed_user):
    from app.models import Employee, Leave
    from app.extensions import db
    with app.app_context():
        from app.models.core import Branch
        branch = Branch.query.first()
        emp = Employee(name='موظف أيام', branch_id=branch.id, status='ACTIVE')
        db.session.add(emp)
        db.session.flush()
        leave = Leave(
            employee_id=emp.id, type='ANNUAL',
            start_date=date(2026, 8, 1), end_date=date(2026, 8, 7),
            status='PENDING',
        )
        db.session.add(leave)
        db.session.commit()
        leave_id = leave.id

    with app.app_context():
        from app.models import Leave as L
        l = db.session.get(L, leave_id)
        assert l.days_count() == 7
