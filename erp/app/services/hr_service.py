from decimal import Decimal
import datetime
from ..extensions import db


def calculate_salary(employee_id: int, period: str,
                     overtime: float = 0, extra_deductions: float = 0):
    """
    Calculate net salary for an employee for a given period (YYYY-MM).
    Returns a dict: {basic, allowances, overtime, deductions, advance_deduction, net}
    Raises ValueError if no active contract found.
    """
    from ..models.hr import Employee, Advance, SalaryPayment

    employee = db.session.get(Employee, employee_id)
    if not employee:
        raise ValueError(f'الموظف غير موجود: {employee_id}')
    contract = employee.active_contract()
    if not contract:
        raise ValueError(f'لا توجد عقد نشط للموظف {employee.name}')

    # Check not already paid
    existing = SalaryPayment.query.filter_by(
        employee_id=employee_id, period=period
    ).first()
    if existing:
        raise ValueError(f'تم صرف راتب {employee.name} لهذه الفترة مسبقاً')

    basic = float(contract.basic_salary)
    allowances = float(contract.total_allowances())
    advance_deduction = 0.0

    # Deduct from outstanding advances
    advances = Advance.query.filter(
        Advance.employee_id == employee_id,
        Advance.repaid_amount < Advance.amount,
    ).order_by(Advance.date).all()
    for adv in advances:
        if float(adv.monthly_deduction) > 0:
            advance_deduction = min(float(adv.monthly_deduction), adv.outstanding_balance())
            break  # one advance at a time — mutation happens in create_salary_payment

    net = basic + allowances + overtime - extra_deductions - advance_deduction
    return {
        'basic': basic,
        'allowances': allowances,
        'overtime': overtime,
        'deductions': extra_deductions,
        'advance_deduction': advance_deduction,
        'net': round(net, 3),
    }


def create_salary_payment(employee_id: int, period: str,
                           overtime: float = 0, extra_deductions: float = 0,
                           created_by: int = None):
    """
    Create SalaryPayment, generate payroll journal entry, return payment.
    """
    from ..models.hr import SalaryPayment, Advance
    from ..services.accounting_service import create_payroll_journal_entry
    import logging

    data = calculate_salary(employee_id, period, overtime, extra_deductions)
    payment = SalaryPayment(
        employee_id=employee_id,
        period=period,
        basic=Decimal(str(data['basic'])),
        allowances=Decimal(str(data['allowances'])),
        overtime=Decimal(str(data['overtime'])),
        deductions=Decimal(str(data['deductions'])),
        advance_deduction=Decimal(str(data['advance_deduction'])),
        net_salary=Decimal(str(data['net'])),
        paid_at=datetime.datetime.utcnow(),
    )
    db.session.add(payment)
    db.session.flush()

    # Apply advance repayment now that payment is staged
    if data['advance_deduction'] > 0:
        adv = Advance.query.filter(
            Advance.employee_id == employee_id,
            Advance.repaid_amount < Advance.amount,
            Advance.monthly_deduction > 0,
        ).order_by(Advance.date).first()
        if adv:
            adv.repaid_amount = Decimal(str(float(adv.repaid_amount) + data['advance_deduction']))

    logger = logging.getLogger(__name__)
    try:
        journal = create_payroll_journal_entry(payment)
        if journal is not None:
            payment.journal_id = journal.id
    except Exception:
        logger.exception('Failed to create payroll journal for employee %s', employee_id)

    db.session.commit()
    return payment
