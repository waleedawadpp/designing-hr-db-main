"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, Cart } from "./api";

type AuthState = {
  token: string | null;
  email: string | null;
  cartCount: number;
  login: (email: string, password: string, totp?: string) => Promise<void>;
  register: (full_name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshCart: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

const TOKEN_KEY = "raf_token";
const EMAIL_KEY = "raf_email";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    setToken(localStorage.getItem(TOKEN_KEY));
    setEmail(localStorage.getItem(EMAIL_KEY));
  }, []);

  const refreshCart = useCallback(async () => {
    if (!token) {
      setCartCount(0);
      return;
    }
    try {
      const cart: Cart = await api.getCart(token);
      setCartCount(cart.items.reduce((n, i) => n + i.quantity, 0));
    } catch {
      setCartCount(0);
    }
  }, [token]);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const persist = (t: string, e: string) => {
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(EMAIL_KEY, e);
    setToken(t);
    setEmail(e);
  };

  const login = useCallback(async (e: string, password: string, totp?: string) => {
    const tokens = await api.login(e, password, totp);
    persist(tokens.access_token, e);
  }, []);

  const register = useCallback(
    async (full_name: string, e: string, password: string) => {
      await api.register({ full_name, email: e, password });
      const tokens = await api.login(e, password);
      persist(tokens.access_token, e);
    },
    [],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
    setToken(null);
    setEmail(null);
    setCartCount(0);
  }, []);

  const value = useMemo(
    () => ({ token, email, cartCount, login, register, logout, refreshCart }),
    [token, email, cartCount, login, register, logout, refreshCart],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
