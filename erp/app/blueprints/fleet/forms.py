from flask_wtf import FlaskForm
from wtforms import StringField, IntegerField, DecimalField, SelectField, DateField, TextAreaField
from wtforms.validators import DataRequired, Optional, NumberRange


class VehicleForm(FlaskForm):
    plate_no = StringField('رقم اللوحة', validators=[DataRequired()])
    model = StringField('الموديل', validators=[Optional()])
    year = IntegerField('سنة الصنع', validators=[Optional()])
    branch_id = SelectField('الفرع', coerce=int, validators=[Optional()])
    driver_id = SelectField('السائق', coerce=int, validators=[Optional()])
    license_expiry = DateField('انتهاء الرخصة', validators=[Optional()])
    status = SelectField('الحالة', choices=[
        ('ACTIVE', 'نشط'), ('MAINTENANCE', 'صيانة'), ('INACTIVE', 'غير نشط')
    ])


class MaintenanceForm(FlaskForm):
    date = DateField('التاريخ', validators=[DataRequired()])
    type = StringField('نوع الصيانة', validators=[Optional()])
    description = StringField('الوصف', validators=[Optional()])
    cost = DecimalField('التكلفة', places=3, default=0, validators=[Optional()])
    next_due_date = DateField('الموعد القادم', validators=[Optional()])


class FuelForm(FlaskForm):
    date = DateField('التاريخ', validators=[DataRequired()])
    liters = DecimalField('اللترات', places=3, validators=[DataRequired(), NumberRange(min=0.001)])
    cost = DecimalField('التكلفة', places=3, validators=[DataRequired()])
    odometer_km = IntegerField('عداد الكيلومترات', validators=[Optional()])


class RouteForm(FlaskForm):
    name = StringField('اسم المسار', validators=[DataRequired()])
    branch_id = SelectField('الفرع', coerce=int, validators=[Optional()])


class LoadOrderForm(FlaskForm):
    vehicle_id = SelectField('المركبة', coerce=int, validators=[DataRequired()])
    driver_id = SelectField('السائق', coerce=int, validators=[Optional()])
    route_id = SelectField('المسار', coerce=int, validators=[Optional()])
    date = DateField('التاريخ', validators=[DataRequired()])
    notes = TextAreaField('ملاحظات', validators=[Optional()])
