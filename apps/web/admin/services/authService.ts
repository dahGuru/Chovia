"use client";

import type { PortalAuthUser } from "@chovia/web-ui";
import { adminApi } from "./api";

export const adminAuthService = {
  async getMe(): Promise<PortalAuthUser> {
    const { data } = await adminApi.get<PortalAuthUser>("/auth/me");
    return data;
  },
};
