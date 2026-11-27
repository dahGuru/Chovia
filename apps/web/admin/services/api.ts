"use client";

import { createPortalApiClient } from "@chovia/web-ui";
import { useAdminAuthStore } from "../store/useAuthStore";
import { ENV } from "../utils/env";

export const adminApi = createPortalApiClient({
  baseURL: ENV.apiBaseUrl,
  getAccessToken: () => useAdminAuthStore.getState().accessToken,
  refreshSession: () => useAdminAuthStore.getState().refreshAccessToken(),
  onUnauthorized: () => useAdminAuthStore.getState().clearSession(),
});
