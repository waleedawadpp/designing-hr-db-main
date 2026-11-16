-- حساب مدير مؤقت لاستعادة الدخول (بموافقة المستخدم). يُنشأ مرة واحدة فقط إن لم يوجد.
-- بعد الدخول: أعد تعيين كلمة مرور حسابك من «المستخدمون» ثم عطّل هذا الحساب.
INSERT INTO `User` (`id`, `email`, `name`, `passwordHash`, `role`, `createdAt`)
SELECT 'tmp-reset-admin', 'reset-admin@hr.local', 'مدير مؤقت (استعادة)', '$2a$10$Zpgkd9gvqauusVAsnbRGxOopKriE/ZThm1by1PRiK2kvy03xWd14m', 'admin', CURRENT_TIMESTAMP(3)
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `User` WHERE `email` = 'reset-admin@hr.local');
