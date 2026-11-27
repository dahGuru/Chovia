import type { PortalBffAuthConfig } from "@chovia/web-ui";

export const RESTAURANT_BFF_CONFIG: PortalBffAuthConfig = {
  backendApiUrl:
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:4000/api/v1",
  cookieName: "chovia_restaurant_rt",
  allowedRoles: ["RESTAURANT_STAFF"],
};
