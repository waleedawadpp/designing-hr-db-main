// على Hostinger يستمع الخادم على 0.0.0.0 (IPv4) بينما يُحلّ "localhost" في Node 22 إلى ::1 (IPv6) أولًا.
// يجلب Next.js بعد redirect() داخل Server Action الصفحةَ التالية من http://localhost:<port>،
// فيفشل الاتصال ويظهر في السجل "failed to get redirect response". تفضيل IPv4 يحلّ ذلك.
import dns from "node:dns";

export function preferIpv4() {
  dns.setDefaultResultOrder("ipv4first");
}
