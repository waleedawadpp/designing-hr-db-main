from flask_wtf import FlaskForm
from wtforms import StringField, SelectField, TextAreaField, DateField, SubmitField
from wtforms.validators import DataRequired, Length, Optional


class AccountForm(FlaskForm):
    code = StringField('كود الحساب', validators=[DataRequired(), Length(max=20)])
    name_ar = StringField('اسم الحساب (عربي)', validators=[DataRequired(), Length(max=150)])
    name_en = StringField('اسم الحساب (إنجليزي)', validators=[Optional(), Length(max=150)])
    type = SelectField('نوع الحساب', choices=[
        ('ASSET', 'أصول'),
        ('LIABILITY', 'خصوم'),
        ('EQUITY', 'حقوق ملكية'),
        ('REVENUE', 'إيرادات'),
        ('EXPENSE', 'مصروفات'),
    ], validators=[DataRequired()])
    normal_balance = SelectField('الرصيد الطبيعي', choices=[
        ('DEBIT', 'مدين'),
        ('CREDIT', 'دائن'),
    ], validators=[DataRequired()])
    parent_id = SelectField('الحساب الأب', coerce=str, validators=[Optional()])
    submit = SubmitField('حفظ')


class JournalEntryForm(FlaskForm):
    date = DateField('التاريخ', validators=[DataRequired()])
    description = TextAreaField('البيان', validators=[DataRequired(), Length(max=500)])
    submit = SubmitField('حفظ القيد')
