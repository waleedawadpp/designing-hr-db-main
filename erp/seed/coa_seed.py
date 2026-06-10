COA_DATA = [
    # Level 1 — root categories
    {'code': '1', 'name_ar': 'الأصول', 'type': 'ASSET', 'parent_code': None, 'normal_balance': 'DEBIT'},
    {'code': '2', 'name_ar': 'الخصوم', 'type': 'LIABILITY', 'parent_code': None, 'normal_balance': 'CREDIT'},
    {'code': '3', 'name_ar': 'حقوق الملكية', 'type': 'EQUITY', 'parent_code': None, 'normal_balance': 'CREDIT'},
    {'code': '4', 'name_ar': 'الإيرادات', 'type': 'REVENUE', 'parent_code': None, 'normal_balance': 'CREDIT'},
    {'code': '5', 'name_ar': 'المصروفات', 'type': 'EXPENSE', 'parent_code': None, 'normal_balance': 'DEBIT'},
    # Level 2
    {'code': '11', 'name_ar': 'الأصول المتداولة', 'type': 'ASSET', 'parent_code': '1', 'normal_balance': 'DEBIT'},
    {'code': '12', 'name_ar': 'الأصول الثابتة', 'type': 'ASSET', 'parent_code': '1', 'normal_balance': 'DEBIT'},
    {'code': '21', 'name_ar': 'الخصوم المتداولة', 'type': 'LIABILITY', 'parent_code': '2', 'normal_balance': 'CREDIT'},
    {'code': '22', 'name_ar': 'الخصوم طويلة الأجل', 'type': 'LIABILITY', 'parent_code': '2', 'normal_balance': 'CREDIT'},
    {'code': '31', 'name_ar': 'رأس المال', 'type': 'EQUITY', 'parent_code': '3', 'normal_balance': 'CREDIT'},
    {'code': '32', 'name_ar': 'الأرباح المحتجزة', 'type': 'EQUITY', 'parent_code': '3', 'normal_balance': 'CREDIT'},
    {'code': '41', 'name_ar': 'إيرادات المبيعات', 'type': 'REVENUE', 'parent_code': '4', 'normal_balance': 'CREDIT'},
    {'code': '42', 'name_ar': 'إيرادات أخرى', 'type': 'REVENUE', 'parent_code': '4', 'normal_balance': 'CREDIT'},
    {'code': '51', 'name_ar': 'تكلفة البضاعة المباعة', 'type': 'EXPENSE', 'parent_code': '5', 'normal_balance': 'DEBIT'},
    {'code': '52', 'name_ar': 'المصروفات الإدارية', 'type': 'EXPENSE', 'parent_code': '5', 'normal_balance': 'DEBIT'},
    {'code': '53', 'name_ar': 'مصروفات المبيعات والتوزيع', 'type': 'EXPENSE', 'parent_code': '5', 'normal_balance': 'DEBIT'},
    {'code': '54', 'name_ar': 'المصروفات المالية', 'type': 'EXPENSE', 'parent_code': '5', 'normal_balance': 'DEBIT'},
    # Level 3 — leaf accounts
    {'code': '1101', 'name_ar': 'الصندوق (الخزينة)', 'type': 'ASSET', 'parent_code': '11', 'normal_balance': 'DEBIT'},
    {'code': '1102', 'name_ar': 'البنوك', 'type': 'ASSET', 'parent_code': '11', 'normal_balance': 'DEBIT'},
    {'code': '1103', 'name_ar': 'ذمم مدينة — عملاء', 'type': 'ASSET', 'parent_code': '11', 'normal_balance': 'DEBIT'},
    {'code': '1104', 'name_ar': 'مخزون بضاعة', 'type': 'ASSET', 'parent_code': '11', 'normal_balance': 'DEBIT'},
    {'code': '1105', 'name_ar': 'مصروفات مدفوعة مقدماً', 'type': 'ASSET', 'parent_code': '11', 'normal_balance': 'DEBIT'},
    {'code': '1106', 'name_ar': 'ضريبة القيمة المضافة — مدخلات', 'type': 'ASSET', 'parent_code': '11', 'normal_balance': 'DEBIT'},
    {'code': '1201', 'name_ar': 'أراضي ومباني', 'type': 'ASSET', 'parent_code': '12', 'normal_balance': 'DEBIT'},
    {'code': '1202', 'name_ar': 'آلات ومعدات', 'type': 'ASSET', 'parent_code': '12', 'normal_balance': 'DEBIT'},
    {'code': '1203', 'name_ar': 'سيارات وأسطول', 'type': 'ASSET', 'parent_code': '12', 'normal_balance': 'DEBIT'},
    {'code': '1204', 'name_ar': 'مجمع الإهلاك — آلات ومعدات', 'type': 'ASSET', 'parent_code': '12', 'normal_balance': 'CREDIT'},
    {'code': '2101', 'name_ar': 'ذمم دائنة — موردون', 'type': 'LIABILITY', 'parent_code': '21', 'normal_balance': 'CREDIT'},
    {'code': '2102', 'name_ar': 'ضريبة القيمة المضافة — مخرجات', 'type': 'LIABILITY', 'parent_code': '21', 'normal_balance': 'CREDIT'},
    {'code': '2103', 'name_ar': 'رواتب مستحقة الدفع', 'type': 'LIABILITY', 'parent_code': '21', 'normal_balance': 'CREDIT'},
    {'code': '2104', 'name_ar': 'تسهيلات بنكية قصيرة الأجل', 'type': 'LIABILITY', 'parent_code': '21', 'normal_balance': 'CREDIT'},
    {'code': '2105', 'name_ar': 'دفعات مقدمة من العملاء', 'type': 'LIABILITY', 'parent_code': '21', 'normal_balance': 'CREDIT'},
    {'code': '2201', 'name_ar': 'قروض طويلة الأجل', 'type': 'LIABILITY', 'parent_code': '22', 'normal_balance': 'CREDIT'},
    {'code': '3101', 'name_ar': 'رأس مال المساهمين', 'type': 'EQUITY', 'parent_code': '31', 'normal_balance': 'CREDIT'},
    {'code': '3201', 'name_ar': 'أرباح السنوات السابقة', 'type': 'EQUITY', 'parent_code': '32', 'normal_balance': 'CREDIT'},
    {'code': '3202', 'name_ar': 'أرباح وخسائر السنة الحالية', 'type': 'EQUITY', 'parent_code': '32', 'normal_balance': 'CREDIT'},
    {'code': '4101', 'name_ar': 'مبيعات بضاعة', 'type': 'REVENUE', 'parent_code': '41', 'normal_balance': 'CREDIT'},
    {'code': '4102', 'name_ar': 'مردودات المبيعات', 'type': 'REVENUE', 'parent_code': '41', 'normal_balance': 'DEBIT'},
    {'code': '4103', 'name_ar': 'خصم مكتسب', 'type': 'REVENUE', 'parent_code': '41', 'normal_balance': 'CREDIT'},
    {'code': '4201', 'name_ar': 'إيرادات أخرى متنوعة', 'type': 'REVENUE', 'parent_code': '42', 'normal_balance': 'CREDIT'},
    {'code': '5101', 'name_ar': 'تكلفة البضاعة المباعة', 'type': 'EXPENSE', 'parent_code': '51', 'normal_balance': 'DEBIT'},
    {'code': '5201', 'name_ar': 'رواتب وأجور إدارية', 'type': 'EXPENSE', 'parent_code': '52', 'normal_balance': 'DEBIT'},
    {'code': '5202', 'name_ar': 'إيجار مكاتب ومستودعات', 'type': 'EXPENSE', 'parent_code': '52', 'normal_balance': 'DEBIT'},
    {'code': '5203', 'name_ar': 'مصروفات عمومية وإدارية', 'type': 'EXPENSE', 'parent_code': '52', 'normal_balance': 'DEBIT'},
    {'code': '5301', 'name_ar': 'رواتب مبيعات وتوزيع', 'type': 'EXPENSE', 'parent_code': '53', 'normal_balance': 'DEBIT'},
    {'code': '5302', 'name_ar': 'مصروفات شحن ونقل', 'type': 'EXPENSE', 'parent_code': '53', 'normal_balance': 'DEBIT'},
    {'code': '5303', 'name_ar': 'مصروفات إعلان وتسويق', 'type': 'EXPENSE', 'parent_code': '53', 'normal_balance': 'DEBIT'},
    {'code': '5401', 'name_ar': 'فوائد بنكية مدفوعة', 'type': 'EXPENSE', 'parent_code': '54', 'normal_balance': 'DEBIT'},
    {'code': '5402', 'name_ar': 'مصروفات جمارك وتخليص', 'type': 'EXPENSE', 'parent_code': '54', 'normal_balance': 'DEBIT'},
]


def seed_coa(db, Account):
    """Seed the standard Arabic chart of accounts. Skips if accounts already exist."""
    if Account.query.count() > 0:
        print("COA already seeded, skipping.")
        return

    code_to_id = {}
    for item in COA_DATA:
        parent_id = code_to_id.get(item['parent_code']) if item['parent_code'] else None
        level = 1
        if parent_id:
            parent = db.session.get(Account, parent_id)
            level = parent.level + 1
        is_leaf = not any(d['parent_code'] == item['code'] for d in COA_DATA)
        acc = Account(
            code=item['code'],
            name_ar=item['name_ar'],
            type=item['type'],
            parent_id=parent_id,
            level=level,
            is_leaf=is_leaf,
            normal_balance=item['normal_balance'],
        )
        db.session.add(acc)
        db.session.flush()
        code_to_id[item['code']] = acc.id
    db.session.commit()
    print(f"Seeded {len(COA_DATA)} chart of accounts entries")
