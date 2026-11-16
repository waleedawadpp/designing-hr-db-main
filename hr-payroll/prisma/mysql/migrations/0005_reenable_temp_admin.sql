-- إعادة تفعيل الحساب المؤقت (عُطّل قبل إعادة تعيين كلمة مرور الحساب الرئيسي) — بطلب المستخدم
UPDATE `User` SET `disabledAt` = NULL WHERE `id` = 'tmp-reset-admin' AND `email` = 'reset-admin@hr.local';
