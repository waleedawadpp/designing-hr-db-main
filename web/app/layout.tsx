import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "RAF — سوق عُمان والخليج",
  description: "سوق RAF الإلكتروني المدعوم بالذكاء الاصطناعي لعُمان ودول الخليج.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen">
        <StoreProvider>
          <Header />
          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
          <footer className="mt-12 border-t border-slate-200 py-8 text-center text-sm text-slate-500">
            RAF Marketplace — عُمان والخليج · مدعوم بالذكاء الاصطناعي
          </footer>
        </StoreProvider>
      </body>
    </html>
  );
}
