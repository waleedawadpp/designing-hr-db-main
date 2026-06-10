import click
from flask.cli import with_appcontext
from .extensions import db


def register_cli(app):
    @app.cli.command('seed')
    @click.option('--demo', is_flag=True, default=True, help='Seed demo data')
    @with_appcontext
    def seed_cmd(demo):
        """Seed the database with initial/demo data."""
        _seed_demo()


def _seed_demo():
    from .models.core import Branch, User, UserRole
    from .models.accounting import Account, AccountType
    from .models.inventory import Warehouse, Category, Product
    from .models.sales import Customer
    from .models.purchasing import Supplier

    # Idempotency check
    if Branch.query.filter_by(code='HQ').first():
        print('البيانات التجريبية موجودة بالفعل')
        return

    try:
        # 1. HQ Branch
        hq = Branch(code='HQ', name='الفرع الرئيسي')
        db.session.add(hq)
        db.session.flush()  # get hq.id
        print('تم إنشاء الفرع الرئيسي')

        # 2. Demo Users
        users_data = [
            {'username': 'admin',      'full_name': 'مدير النظام',    'role': UserRole.GENERAL_MANAGER, 'password': 'admin123'},
            {'username': 'accountant', 'full_name': 'المحاسب',        'role': UserRole.ACCOUNTANT,      'password': 'acc123'},
            {'username': 'warehouse',  'full_name': 'أمين المستودع',  'role': UserRole.WAREHOUSE_KEEPER,'password': 'wh123'},
        ]
        for u_data in users_data:
            user = User(
                username=u_data['username'],
                full_name=u_data['full_name'],
                role=u_data['role'],
                branch_id=hq.id,
            )
            user.set_password(u_data['password'])
            db.session.add(user)
        print('تم إنشاء المستخدمين التجريبيين')

        # 3. Chart of Accounts (COA)
        coa_data = [
            ('1101', 'ح/الصندوق',                 'Cash',               AccountType.ASSET,     'DEBIT'),
            ('1103', 'ذمم عملاء',                  'Accounts Receivable', AccountType.ASSET,     'DEBIT'),
            ('1104', 'مخزون بضاعة',                'Inventory',          AccountType.ASSET,     'DEBIT'),
            ('1105', 'ضريبة مدخلات',               'Input VAT',          AccountType.ASSET,     'DEBIT'),
            ('2101', 'ذمم دائنة موردين',            'Accounts Payable',   AccountType.LIABILITY, 'CREDIT'),
            ('2102', 'ضريبة مخرجات',               'Output VAT',         AccountType.LIABILITY, 'CREDIT'),
            ('2103', 'مستحقات الموظفين',            'Accrued Salaries',   AccountType.LIABILITY, 'CREDIT'),
            ('4101', 'المبيعات',                   'Sales Revenue',      AccountType.REVENUE,   'CREDIT'),
            ('5101', 'تكلفة البضاعة المباعة',       'Cost of Goods Sold', AccountType.EXPENSE,   'DEBIT'),
            ('5201', 'مصروف رواتب',                'Salary Expense',     AccountType.EXPENSE,   'DEBIT'),
        ]
        for code, name_ar, name_en, acc_type, normal_balance in coa_data:
            account = Account(
                code=code,
                name_ar=name_ar,
                name_en=name_en,
                type=acc_type,
                normal_balance=normal_balance,
                is_leaf=True,
                level=1,
            )
            db.session.add(account)
        print('تم إنشاء دليل الحسابات')

        # 4. Main Warehouse
        warehouse = Warehouse(name='المستودع الرئيسي', branch_id=hq.id)
        db.session.add(warehouse)
        print('تم إنشاء المستودع الرئيسي')

        # 5. Product Categories
        categories_data = [
            ('إلكترونيات',   'Electronics'),
            ('مواد غذائية',  'Food'),
            ('مواد تنظيف',   'Cleaning'),
            ('قرطاسية',      'Stationery'),
            ('متنوعات',      'Other'),
        ]
        categories = []
        for name_ar, name_en in categories_data:
            cat = Category(name=name_ar)
            db.session.add(cat)
            categories.append(cat)
        db.session.flush()  # get category IDs
        print('تم إنشاء فئات المنتجات')

        # 6. Demo Products (4 per category, 20 total)
        # VAT: 0% for food, 5% for others
        electronics_cat, food_cat, cleaning_cat, stationery_cat, other_cat = categories

        products_data = [
            # Electronics (cat index 0) — 5% VAT
            ('ELEC-001', 'هاتف ذكي سامسونج', 'Samsung Smartphone',    electronics_cat.id, 'PCS', 300.000, 450.000, 5,  5.0),
            ('ELEC-002', 'لابتوب لينوفو',     'Lenovo Laptop',         electronics_cat.id, 'PCS', 800.000,1200.000, 3,  5.0),
            ('ELEC-003', 'شاشة LCD 24 بوصة',  'LCD Monitor 24"',       electronics_cat.id, 'PCS', 150.000, 220.000, 5,  5.0),
            ('ELEC-004', 'طابعة HP',           'HP Printer',            electronics_cat.id, 'PCS', 120.000, 180.000, 4,  5.0),
            # Food (cat index 1) — 0% VAT
            ('FOOD-001', 'زيت طبخ 5 لتر',     'Cooking Oil 5L',        food_cat.id,        'BOX',   25.000,  35.000,20,  0.0),
            ('FOOD-002', 'أرز بسمتي 10 كجم',  'Basmati Rice 10kg',     food_cat.id,        'BOX',   30.000,  42.000,15,  0.0),
            ('FOOD-003', 'سكر أبيض 5 كجم',    'White Sugar 5kg',       food_cat.id,        'BOX',   12.000,  18.000,25,  0.0),
            ('FOOD-004', 'دقيق قمح 10 كجم',   'Wheat Flour 10kg',      food_cat.id,        'BOX',   14.000,  20.000,20,  0.0),
            # Cleaning (cat index 2) — 5% VAT
            ('CLEAN-001','صابون سائل 1 لتر',  'Liquid Soap 1L',        cleaning_cat.id,    'PCS',    5.000,   9.000,30,  5.0),
            ('CLEAN-002','مسحوق غسيل 3 كجم',  'Washing Powder 3kg',    cleaning_cat.id,    'BOX',   15.000,  24.000,20,  5.0),
            ('CLEAN-003','منظف أرضيات',        'Floor Cleaner',         cleaning_cat.id,    'PCS',    6.000,  10.000,25,  5.0),
            ('CLEAN-004','معطر هواء',          'Air Freshener',         cleaning_cat.id,    'PCS',    4.000,   7.500,30,  5.0),
            # Stationery (cat index 3) — 5% VAT
            ('STAT-001', 'ورق طباعة A4 500 ورقة','A4 Paper 500 sheets', stationery_cat.id, 'BOX',    8.000,  13.000,20,  5.0),
            ('STAT-002', 'أقلام حبر أزرق علبة',  'Blue Ballpoint Pens', stationery_cat.id, 'BOX',    3.000,   5.500,30,  5.0),
            ('STAT-003', 'دفتر مذكرات A5',        'A5 Notebook',         stationery_cat.id, 'PCS',    1.500,   3.000,40,  5.0),
            ('STAT-004', 'ملفات بلاستيكية',       'Plastic Folders',     stationery_cat.id, 'BOX',    4.000,   7.000,25,  5.0),
            # Other/misc (cat index 4) — 5% VAT
            ('MISC-001', 'بطارية AA علبة 4',   'AA Batteries Pack 4',   other_cat.id,       'PCS',    2.500,   5.000,50,  5.0),
            ('MISC-002', 'شريط لاصق',           'Adhesive Tape',         other_cat.id,       'PCS',    0.800,   1.800,50,  5.0),
            ('MISC-003', 'حقيبة تسوق',          'Shopping Bag',          other_cat.id,       'PCS',    0.500,   1.200,100, 5.0),
            ('MISC-004', 'صندوق تخزين بلاستيك', 'Plastic Storage Box',   other_cat.id,       'PCS',   10.000,  18.000,15,  5.0),
        ]

        for code, name_ar, name_en, cat_id, unit, cost_price, sale_price, reorder_level, vat_rate in products_data:
            product = Product(
                code=code,
                name_ar=name_ar,
                name_en=name_en,
                category_id=cat_id,
                unit=unit,
                cost_price=cost_price,
                sale_price=sale_price,
                reorder_level=reorder_level,
                vat_rate=vat_rate,
            )
            db.session.add(product)
        print('تم إنشاء المنتجات التجريبية')

        # 7. Customers
        customers_data = [
            ('CUST-001', 'شركة الأمل للتجارة',      '0501234567', 'الرياض',  5000.000),
            ('CUST-002', 'مؤسسة النور',              '0502345678', 'جدة',     3000.000),
            ('CUST-003', 'شركة الخليج للمقاولات',   '0503456789', 'الدمام',  8000.000),
            ('CUST-004', 'مؤسسة الفجر التجارية',    '0504567890', 'مكة',     2000.000),
            ('CUST-005', 'شركة الرياض الدولية',     '0505678901', 'الرياض', 10000.000),
        ]
        for code, name, phone, address, credit_limit in customers_data:
            customer = Customer(
                code=code,
                name=name,
                phone=phone,
                address=address,
                credit_limit=credit_limit,
                branch_id=hq.id,
            )
            db.session.add(customer)
        print('تم إنشاء العملاء التجريبيين')

        # 8. Suppliers
        suppliers_data = [
            ('مصنع الوطن للمواد الغذائية',  'السعودية', '0511111111', 'factory@alwatan.sa', 30),
            ('شركة التقنية للإلكترونيات',   'الإمارات', '0522222222', 'info@tech-elec.ae',  45),
            ('مؤسسة النظافة للمواد التنظيف','السعودية', '0533333333', 'clean@naza.sa',      30),
            ('شركة الورق والقرطاسية',       'مصر',      '0544444444', 'paper@stationery.eg',60),
            ('مخازن المتنوعات العامة',      'السعودية', '0555555555', 'misc@stores.sa',     30),
        ]
        for name, country, phone, email, payment_terms in suppliers_data:
            supplier = Supplier(
                name=name,
                country=country,
                phone=phone,
                email=email,
                payment_terms=payment_terms,
            )
            db.session.add(supplier)
        print('تم إنشاء الموردين التجريبيين')

        db.session.commit()
        print('تم بذر البيانات التجريبية بنجاح!')

    except Exception as e:
        db.session.rollback()
        print(f'خطأ أثناء بذر البيانات: {e}')
        raise
