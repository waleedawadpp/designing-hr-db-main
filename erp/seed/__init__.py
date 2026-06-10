def run_seed(db, app):
    """Called by `flask seed` CLI command."""
    with app.app_context():
        db.create_all()
        from app.models import Account
        from seed.coa_seed import seed_coa
        seed_coa(db, Account)
        print("Seed complete")
