from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, BooleanField, SubmitField
from wtforms.validators import DataRequired


class LoginForm(FlaskForm):
    username = StringField('اسم المستخدم', validators=[DataRequired(message='مطلوب')])
    password = PasswordField('كلمة المرور', validators=[DataRequired(message='مطلوب')])
    remember_me = BooleanField('تذكرني')
    submit = SubmitField('دخول')
