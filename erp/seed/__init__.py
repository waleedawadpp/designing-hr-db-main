def run_seed(db, app):
    """Called by `flask seed` CLI command."""
    with app.app_context():
        db.create_all()
        print("Database tables created. Add seed modules and call them here.")
