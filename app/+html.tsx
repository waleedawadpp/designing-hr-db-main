// app/+html.tsx
// يخصّص قالب HTML الجذري لنسخة الويب (Static Rendering).
// نضبط هنا اللغة العربية والاتجاه RTL على مستوى الصفحة نفسها
// لتجنّب ظهور التخطيط من اليسار لليمين للحظة قبل تحميل JavaScript.

import { ScrollViewStyleReset } from "expo-router/html";
import { type PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        {/* يمنع وميض الخلفية ويضبط تمرير الصفحة على الويب */}
        <ScrollViewStyleReset />
        <style>{`
          html, body { background-color: #F5F3FF; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
