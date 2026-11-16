// على Hostinger يستمع الخادم على 0.0.0.0 (IPv4) بينما يُحلّ "localhost" في Node 22 إلى ::1 (IPv6) أولًا.
// يجلب Next.js بعد redirect() داخل Server Action الصفحةَ التالية من http://localhost:<port>،
// فيفشل الاتصال ويظهر في السجل "failed to get redirect response". تفضيل IPv4 يحلّ ذلك.
// تُجلب الوحدة وقت التشغيل (process.getBuiltinModule) لأن instrumentation يُجمَّع لبيئة Edge أيضًا.
type DnsModule = { setDefaultResultOrder(order: "ipv4first" | "verbatim"): void };

export function preferIpv4() {
  const p = process as unknown as { getBuiltinModule?: (id: string) => unknown };
  const dns = p.getBuiltinModule?.("node:dns") as DnsModule | undefined;
  dns?.setDefaultResultOrder("ipv4first");
}
