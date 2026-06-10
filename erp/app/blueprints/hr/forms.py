from flask_wtf import FlaskForm
from wtforms import (StringField, DecimalField, SelectField, DateField,
                     TextAreaField, IntegerField)
from wtforms.validators import DataRequired, Optional, NumberRange


class EmployeeForm(FlaskForm):
    name = StringField('الاسم الكامل', validators=[DataRequired()])
    nat_id = StringField('رقم الهوية', validators=[Optional()])
    branch_id = SelectField('الفرع', coerce=int, validators=[Optional()])
    dept_id = SelectField('القسم', coerce=int, validators=[Optional()])
    position = StringField('المسمى الوظيفي', validators=[Optional()])
    email = StringField('البريد الإلكتروني', validators=[Optional()])
    phone = StringField('الهاتف', validators=[Optional()])
    hire_date = DateField('تاريخ التوظيف', validators=[Optional()])
    status = SelectField('الحالة', choices=[
        ('ACTIVE', 'نشط'), ('ON_LEAVE', 'في إجازة'), ('TERMINATED', 'منهي الخدمة')
    ], default='ACTIVE')


class ContractForm(FlaskForm):
    type = SelectField('نوع العقد', choices=[('FULL_TIME', 'دوام كامل'), ('PART_TIME', 'دوام جزئي')])
    start_date = DateField('تاريخ البداية', validators=[DataRequired()])
    end_date = DateField('تاريخ النهاية', validators=[Optional()])
    basic_salary = DecimalField('الراتب الأساسي', places=3, validators=[DataRequired()])
    housing_allowance = DecimalField('بدل سكن', places=3, default=0, validators=[Optional()])
    transport_allowance = DecimalField('بدل مواصلات', places=3, default=0, validators=[Optional()])


class AttendanceForm(FlaskForm):
    date = DateField('التاريخ', validators=[DataRequired()])
    status = SelectField('الحالة', choices=[
        ('PRESENT', 'حاضر'), ('ABSENT', 'غائب'),
        ('LATE', 'متأخر'), ('HALF_DAY', 'نصف يوم')
    ])


class LeaveForm(FlaskForm):
    type = SelectField('نوع الإجازة', choices=[
        ('ANNUAL', 'سنوية'), ('SICK', 'مرضية'),
        ('EMERGENCY', 'طارئة'), ('UNPAID', 'بدون راتب')
    ])
    start_date = DateField('من', validators=[DataRequired()])
    end_date = DateField('إلى', validators=[DataRequired()])
    reason = TextAreaField('السبب', validators=[Optional()])


class SalaryPaymentForm(FlaskForm):
    period = StringField('الفترة (YYYY-MM)', validators=[DataRequired()])
    overtime = DecimalField('أوفرتايم', places=3, default=0, validators=[Optional()])
    extra_deductions = DecimalField('استقطاعات إضافية', places=3, default=0, validators=[Optional()])


class AdvanceForm(FlaskForm):
    amount = DecimalField('المبلغ', places=3, validators=[DataRequired(), NumberRange(min=0.001)])
    date = DateField('التاريخ', validators=[DataRequired()])
    monthly_deduction = DecimalField('الخصم الشهري', places=3, default=0, validators=[Optional()])
    notes = StringField('ملاحظات', validators=[Optional()])
