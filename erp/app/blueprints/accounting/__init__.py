from flask import Blueprint

accounting_bp = Blueprint('accounting', __name__, url_prefix='/accounting')

from . import routes  # noqa: E402,F401
from . import reports  # noqa: E402,F401
