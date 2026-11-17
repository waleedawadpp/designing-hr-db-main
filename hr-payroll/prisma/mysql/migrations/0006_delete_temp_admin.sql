-- حذف الحساب المؤقت بعد استعادة الدخول إلى الحساب الرئيسي — بطلب المستخدم
DELETE FROM `User` WHERE `id` = 'tmp-reset-admin' AND `email` = 'reset-admin@hr.local';
