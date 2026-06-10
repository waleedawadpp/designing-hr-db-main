import pytest
from app import create_app
from app.extensions import db as _db
from app.models import User, Branch, UserRole


@pytest.fixture(scope='session')
def app():
    application = create_app('testing')
    with application.app_context():
        _db.create_all()
        yield application
        _db.drop_all()


@pytest.fixture(scope='function')
def client(app):
    return app.test_client()


@pytest.fixture(scope='function')
def seed_user(app):
    with app.app_context():
        branch = Branch(code='HQ', name='الفرع الرئيسي')
        _db.session.add(branch)
        _db.session.flush()
        user = User(
            username='admin',
            full_name='مدير النظام',
            role=UserRole.GENERAL_MANAGER,
            branch_id=branch.id
        )
        user.set_password('admin123')
        _db.session.add(user)
        _db.session.commit()
        yield user
        _db.session.query(User).delete()
        _db.session.query(Branch).delete()
        _db.session.commit()


@pytest.fixture(scope='function')
def logged_in_client(client, seed_user):
    client.post('/auth/login', data={
        'username': 'admin',
        'password': 'admin123'
    }, follow_redirects=True)
    return client
