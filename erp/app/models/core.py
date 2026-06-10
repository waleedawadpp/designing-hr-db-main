from datetime import datetime
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from ..extensions import db, login_manager


class Branch(db.Model):
    __tablename__ = 'branches'
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(10), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    address = db.Column(db.String(255))
    phone = db.Column(db.String(20))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Department(db.Model):
    __tablename__ = 'departments'
    id = db.Column(db.Integer, primary_key=True)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    branch = db.relationship('Branch', backref='departments')


class UserRole:
    GENERAL_MANAGER = 'general_manager'
    BRANCH_MANAGER = 'branch_manager'
    ACCOUNTANT = 'accountant'
    WAREHOUSE_KEEPER = 'warehouse_keeper'
    SALES_STAFF = 'sales_staff'
    DRIVER = 'driver'

    ALL_ROLES = [
        GENERAL_MANAGER, BRANCH_MANAGER, ACCOUNTANT,
        WAREHOUSE_KEEPER, SALES_STAFF, DRIVER
    ]
    LABELS = {
        GENERAL_MANAGER: 'مدير عام',
        BRANCH_MANAGER: 'مدير فرع',
        ACCOUNTANT: 'محاسب',
        WAREHOUSE_KEEPER: 'أمين مخزن',
        SALES_STAFF: 'موظف مبيعات',
        DRIVER: 'سائق',
    }


class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(30), nullable=False, default=UserRole.SALES_STAFF)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    branch = db.relationship('Branch', backref='users')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    @property
    def is_general_manager(self):
        return self.role == UserRole.GENERAL_MANAGER

    def can_access_branch(self, branch_id):
        if self.is_general_manager:
            return True
        return self.branch_id == branch_id

    def role_label(self):
        return UserRole.LABELS.get(self.role, self.role)


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))
