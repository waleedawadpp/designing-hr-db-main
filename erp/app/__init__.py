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

    from .cli import register_cli
    register_cli(app)

    return app

def _register_blueprints(app):
    import logging
    import importlib
    logger = logging.getLogger(__name__)
    blueprint_configs = [
        ('app.blueprints.auth', 'auth_bp'),
        ('app.blueprints.dashboard', 'dashboard_bp'),
        ('app.blueprints.branches', 'branches_bp'),
        ('app.blueprints.hr', 'hr_bp'),
        ('app.blueprints.accounting', 'accounting_bp'),
        ('app.blueprints.inventory', 'inventory_bp'),
        ('app.blueprints.purchasing', 'purchasing_bp'),
        ('app.blueprints.sales', 'sales_bp'),
        ('app.blueprints.fleet', 'fleet_bp'),
        ('app.blueprints.reports', 'reports_bp'),
    ]
    for module_path, bp_name in blueprint_configs:
        try:
            module = importlib.import_module(module_path)
            bp = getattr(module, bp_name)
            app.register_blueprint(bp)
            logger.debug(f"Registered blueprint: {bp_name}")
        except ImportError:
            logger.debug(f"Blueprint not yet available: {module_path}")
        except Exception as e:
            logger.error(f"Failed to register blueprint {bp_name}: {e}")
            raise
