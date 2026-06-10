from flask_wtf import FlaskForm
from wtforms import StringField, SelectField, TextAreaField, SubmitField
from wtforms.validators import DataRequired, Optional, Length


class CustomerForm(FlaskForm):
    name = StringField('اسم العميل', validators=[DataRequired(), Length(max=150)])
    type = SelectField('نوع العميل', choices=[('RETAIL', 'تجزئة'), ('WHOLESALE', 'جملة')])
    phone = StringField('الهاتف', validators=[Optional(), Length(max=20)])
    address = TextAreaField('العنوان', validators=[Optional()])
    tax_no = StringField('الرقم الضريبي', validators=[Optional(), Length(max=50)])
    credit_limit = StringField('حد الائتمان', validators=[Optional()])
    submit = SubmitField('حفظ')
