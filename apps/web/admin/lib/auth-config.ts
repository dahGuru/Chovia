import type { PortalBffAuthConfig } from "@chovia/web-ui";

export const ADMIN_BFF_CONFIG: PortalBffAuthConfig = {
  backendApiUrl:
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:4000/api/v1",
  cookieName: "chovia_admin_rt",
  allowedRoles: ["ADMIN"],
};
