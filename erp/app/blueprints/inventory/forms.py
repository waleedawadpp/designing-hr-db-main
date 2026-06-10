from flask_wtf import FlaskForm
from wtforms import StringField, DecimalField, SelectField, BooleanField, DateField
from wtforms.validators import DataRequired, Optional, NumberRange


class CategoryForm(FlaskForm):
    name = StringField('اسم الفئة', validators=[DataRequired()])
    parent_id = SelectField('الفئة الأب', coerce=int, validators=[Optional()])


class ProductForm(FlaskForm):
    code = StringField('الكود', validators=[DataRequired()])
    barcode = StringField('الباركود', validators=[Optional()])
    name_ar = StringField('الاسم (عربي)', validators=[DataRequired()])
    name_en = StringField('الاسم (إنجليزي)', validators=[Optional()])
    category_id = SelectField('الفئة', coerce=int, validators=[Optional()])
    unit = SelectField('الوحدة',
                       choices=[('PCS', 'قطعة'), ('KG', 'كيلوغرام'),
                                 ('BOX', 'صندوق'), ('L', 'لتر')],
                       validators=[DataRequired()])
    sale_price = DecimalField('سعر البيع', places=3, validators=[DataRequired()])
    cost_price = DecimalField('سعر التكلفة', places=3, default=0,
                               validators=[Optional()])
    reorder_level = DecimalField('حد إعادة الطلب', places=3, default=0,
                                  validators=[Optional()])
    vat_rate = DecimalField('نسبة الضريبة %', places=2, default=5,
                             validators=[Optional()])


class WarehouseForm(FlaskForm):
    name = StringField('اسم المستودع', validators=[DataRequired()])
    branch_id = SelectField('الفرع', coerce=int, validators=[DataRequired()])
    location = StringField('الموقع', validators=[Optional()])


class StockMovementForm(FlaskForm):
    product_id = SelectField('الصنف', coerce=int, validators=[DataRequired()])
    warehouse_id = SelectField('المستودع', coerce=int, validators=[DataRequired()])
    type = SelectField('نوع الحركة',
                       choices=[('IN', 'وارد'), ('OUT', 'صادر'),
                                 ('ADJUSTMENT', 'تسوية')],
                       validators=[DataRequired()])
    qty = DecimalField('الكمية', places=3,
                       validators=[DataRequired(), NumberRange(min=0.001)])
    batch_no = StringField('رقم الدفعة', validators=[Optional()])
    expiry_date = DateField('تاريخ الانتهاء', validators=[Optional()])
    reference = StringField('المرجع', validators=[Optional()])
    date = DateField('التاريخ', validators=[DataRequired()])


class StockTransferForm(FlaskForm):
    from_warehouse_id = SelectField('من مستودع', coerce=int,
                                     validators=[DataRequired()])
    to_warehouse_id = SelectField('إلى مستودع', coerce=int,
                                   validators=[DataRequired()])
    date = DateField('التاريخ', validators=[DataRequired()])
