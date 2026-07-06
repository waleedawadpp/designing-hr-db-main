"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";

export function Header() {
  const { token, email, cartCount, logout } = useStore();
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-2xl font-bold text-brand">
          RAF
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="hover:text-brand">
            المنتجات
          </Link>
          <Link href="/cart" className="relative hover:text-brand">
            السلة
            {cartCount > 0 && (
              <span className="absolute -top-3 -left-3 rounded-full bg-brand px-1.5 text-xs font-bold text-white">
                {cartCount}
              </span>
            )}
          </Link>
          {token ? (
            <>
              <span className="hidden text-slate-500 sm:inline">{email}</span>
              <button
                onClick={logout}
                className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50"
              >
                خروج
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-brand px-3 py-1 font-semibold text-white hover:bg-brand-dark"
            >
              دخول
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
