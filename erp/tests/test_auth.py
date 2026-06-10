def test_login_page_loads(client):
    rv = client.get('/auth/login')
    assert rv.status_code == 200
    assert 'تسجيل الدخول' in rv.data.decode('utf-8')


def test_login_valid_user(client, seed_user):
    rv = client.post('/auth/login', data={
        'username': 'admin',
        'password': 'admin123'
    }, follow_redirects=True)
    assert rv.status_code == 200
    assert 'لوحة التحكم' in rv.data.decode('utf-8')


def test_login_wrong_password(client, seed_user):
    rv = client.post('/auth/login', data={
        'username': 'admin',
        'password': 'wrong'
    }, follow_redirects=True)
    assert 'بيانات الدخول غير صحيحة' in rv.data.decode('utf-8')


def test_login_inactive_user(app, client):
    from app.extensions import db
    from app.models import User, Branch, UserRole
    with app.app_context():
        branch = Branch(code='B2', name='فرع 2')
        db.session.add(branch)
        db.session.flush()
        user = User(username='inactive', full_name='موظف معطل',
                    role=UserRole.SALES_STAFF, branch_id=branch.id, is_active=False)
        user.set_password('pass123')
        db.session.add(user)
        db.session.commit()
        branch_id = branch.id
    try:
        rv = client.post('/auth/login', data={
            'username': 'inactive', 'password': 'pass123'
        }, follow_redirects=True)
        assert 'بيانات الدخول غير صحيحة' in rv.data.decode('utf-8')
    finally:
        with app.app_context():
            db.session.query(User).filter_by(username='inactive').delete()
            db.session.query(Branch).filter_by(id=branch_id).delete()
            db.session.commit()


def test_logout(client, logged_in_client):
    rv = logged_in_client.get('/auth/logout', follow_redirects=True)
    assert 'تسجيل الدخول' in rv.data.decode('utf-8')


def test_dashboard_requires_login(client):
    rv = client.get('/dashboard/', follow_redirects=False)
    assert rv.status_code == 302
    assert '/auth/login' in rv.headers['Location']
