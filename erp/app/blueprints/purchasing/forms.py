from flask_wtf import FlaskForm
from wtforms import StringField, DecimalField, SelectField, DateField, IntegerField, TextAreaField
from wtforms.validators import DataRequired, Optional, NumberRange, Email


class SupplierForm(FlaskForm):
    name = StringField('اسم المورد', validators=[DataRequired()])
    country = StringField('الدولة', validators=[Optional()])
    contact = StringField('جهة الاتصال', validators=[Optional()])
    email = StringField('البريد الإلكتروني', validators=[Optional()])
    phone = StringField('الهاتف', validators=[Optional()])
    payment_terms = IntegerField('أجل الدفع (أيام)', default=30, validators=[Optional()])


class PurchaseOrderForm(FlaskForm):
    supplier_id = SelectField('المورد', coerce=int, validators=[DataRequired()])
    branch_id = SelectField('الفرع', coerce=int, validators=[Optional()])
    date = DateField('تاريخ الطلب', validators=[DataRequired()])
    expected_date = DateField('تاريخ التوقع', validators=[Optional()])
    currency = SelectField('العملة', choices=[('SAR', 'ريال سعودي'), ('USD', 'دولار'), ('EUR', 'يورو'), ('AED', 'درهم')], default='SAR')
    exchange_rate = DecimalField('سعر الصرف', places=4, default=1, validators=[Optional()])
    notes = TextAreaField('ملاحظات', validators=[Optional()])


class ImportCostForm(FlaskForm):
    cost_type = SelectField('نوع التكلفة', choices=[
        ('SHIPPING', 'شحن'), ('CUSTOMS', 'جمارك'),
        ('CLEARANCE', 'تخليص'), ('OTHER', 'أخرى')
    ], validators=[DataRequired()])
    amount = DecimalField('المبلغ', places=3, validators=[DataRequired(), NumberRange(min=0.001)])
    currency = SelectField('العملة', choices=[('SAR', 'ريال'), ('USD', 'دولار'), ('EUR', 'يورو')], default='SAR')
    notes = StringField('ملاحظات', validators=[Optional()])


class GoodsReceiptForm(FlaskForm):
    warehouse_id = SelectField('المستودع', coerce=int, validators=[DataRequired()])
    date = DateField('تاريخ الاستلام', validators=[DataRequired()])
