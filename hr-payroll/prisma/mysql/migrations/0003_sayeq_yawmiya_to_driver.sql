-- تعديل بيانات: «سايق يومية» (622013) مسجّل «موظف» براتب 0 — يصبح «سائق يومي» بأجرة يومية 15 (بطلب المستخدم)
-- يطال هذا الموظف فقط، وفقط إن كان ما زال «موظف»
UPDATE `Employee` SET `type` = 'سائق يومي', `dailyWage` = 15, `monthlySalary` = NULL, `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `code` = '622013' AND `name` = 'سايق يومية' AND `type` = 'موظف';

INSERT INTO `AuditLog` (`id`, `at`, `userEmail`, `action`, `entity`, `entityId`, `summary`)
SELECT UUID(), CURRENT_TIMESTAMP(3), 'migration@system', 'update', 'Employee', `id`, 'تغيير نوع سايق يومية (622013) من موظف إلى سائق يومي بأجرة يومية 15'
FROM `Employee` WHERE `code` = '622013' AND `name` = 'سايق يومية' AND `type` = 'سائق يومي' AND `dailyWage` = 15;
