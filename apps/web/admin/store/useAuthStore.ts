"use client";

import { create } from "zustand";
import type { PortalAuthUser } from "@chovia/web-ui";
import { ApiClientError } from "@chovia/web-ui";

interface AdminAuthState {
  user: PortalAuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
  clearSession: () => void;
  hydrate: () => Promise<void>;
  refreshAccessToken: () => Promise<string | null>;
  login: (email: string, password: string) => Promise<PortalAuthUser>;
  logout: () => Promise<void>;
  clearError: () => void;
}

let inFlightHydration: Promise<void> | null = null;

async function callAdminBff<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-CHOVIA-CSRF": "1",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const payload = (await res.json().catch(() => null)) as
    | (T & { code?: string; message?: string; details?: unknown })
    | null;

  if (!res.ok) {
    throw new ApiClientError(
      res.status,
      payload?.code || "AUTH_ERROR",
      payload?.message || "Authentication failed",
      payload?.details
    );
  }

  return payload as T;
}

export const useAdminAuthStore = create<AdminAuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isHydrated: false,
  isLoading: false,
  error: null,

  clearSession: () =>
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isHydrated: true,
      isLoading: false,
    }),

  refreshAccessToken: async () => {
    try {
      const data = await callAdminBff<{ accessToken: string; user: PortalAuthUser }>(
        "/api/auth/refresh"
      );
      set({
        accessToken: data.accessToken,
        user: data.user,
        isAuthenticated: true,
        isHydrated: true,
      });
      return data.accessToken;
    } catch {
      get().clearSession();
      return null;
    }
  },

  hydrate: async () => {
    if (get().isHydrated) return;
    if (inFlightHydration) return inFlightHydration;

    inFlightHydration = (async () => {
      set({ isLoading: true, error: null });
      try {
        await get().refreshAccessToken();
      } finally {
        set({ isHydrated: true, isLoading: false });
        inFlightHydration = null;
      }
    })();

    return inFlightHydration;
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await callAdminBff<{ accessToken: string; user: PortalAuthUser }>(
        "/api/auth/login",
        { email: email.trim().toLowerCase(), password }
      );
      set({
        accessToken: data.accessToken,
        user: data.user,
        isAuthenticated: true,
        isHydrated: true,
        isLoading: false,
        error: null,
      });
      return data.user;
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Failed to sign in. Please try again.";
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await callAdminBff<{ success: boolean }>("/api/auth/logout").catch(() => undefined);
    } finally {
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isHydrated: true,
        isLoading: false,
        error: null,
      });
    }
  },

  clearError: () => set({ error: null }),
}));
