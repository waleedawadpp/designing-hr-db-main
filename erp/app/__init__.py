import os
from flask import Flask
from .extensions import db, login_manager, migrate, csrf
from .config import config

def create_app(config_name=None):
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'default')
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    db.init_app(app)
    login_manager.init_app(app)
    migrate.init_app(app, db)
    csrf.init_app(app)

    _register_blueprints(app)

    @app.cli.command('seed')
    def seed_command():
        """Seed the database with initial data."""
        from seed import run_seed
        run_seed(db, app)

    return app

def _register_blueprints(app):
    try:
        from .blueprints.auth import auth_bp
        app.register_blueprint(auth_bp)
    except ImportError:
        pass
    try:
        from .blueprints.dashboard import dashboard_bp
        app.register_blueprint(dashboard_bp)
    except ImportError:
        pass
    try:
        from .blueprints.branches import branches_bp
        app.register_blueprint(branches_bp)
    except ImportError:
        pass
    try:
        from .blueprints.hr import hr_bp
        app.register_blueprint(hr_bp)
    except ImportError:
        pass
    try:
        from .blueprints.accounting import accounting_bp
        app.register_blueprint(accounting_bp)
    except ImportError:
        pass
    try:
        from .blueprints.inventory import inventory_bp
        app.register_blueprint(inventory_bp)
    except ImportError:
        pass
    try:
        from .blueprints.purchasing import purchasing_bp
        app.register_blueprint(purchasing_bp)
    except ImportError:
        pass
    try:
        from .blueprints.sales import sales_bp
        app.register_blueprint(sales_bp)
    except ImportError:
        pass
    try:
        from .blueprints.fleet import fleet_bp
        app.register_blueprint(fleet_bp)
    except ImportError:
        pass
    try:
        from .blueprints.reports import reports_bp
        app.register_blueprint(reports_bp)
    except ImportError:
        pass
