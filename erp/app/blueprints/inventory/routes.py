from flask import jsonify, request
from flask_login import login_required
from . import inventory_bp
from ...models import Product


@inventory_bp.route('/products')
@login_required
def products():
    """List page — stub until Task 5."""
    from flask import render_template
    items = Product.query.filter_by(is_active=True).order_by(Product.name_ar).all()
    return render_template('inventory/products/index.html', products=items)


@inventory_bp.route('/api/products')
@login_required
def api_products():
    """JSON endpoint for invoice form product search."""
    q = request.args.get('q', '').strip()
    query = Product.query.filter_by(is_active=True)
    if q:
        query = query.filter(
            Product.name_ar.ilike(f'%{q}%') |
            Product.code.ilike(f'%{q}%') |
            Product.barcode.ilike(f'%{q}%')
        )
    items = query.limit(50).all()
    return jsonify([{
        'id': p.id,
        'code': p.code,
        'name_ar': p.name_ar,
        'barcode': p.barcode or '',
        'sale_price': float(p.sale_price),
        'vat_rate': float(p.vat_rate),
        'unit': p.unit,
    } for p in items])
