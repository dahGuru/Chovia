"use client";

import { createPortalApiClient } from "@chovia/web-ui";
import { useAuthStore } from "../store/useAuthStore";
import { ENV } from "../utils/env";

export const api = createPortalApiClient({
  baseURL: ENV.apiBaseUrl,
  getAccessToken: () => useAuthStore.getState().accessToken,
  refreshSession: () => useAuthStore.getState().refreshAccessToken(),
  onUnauthorized: () => useAuthStore.getState().clearSession(),
});
