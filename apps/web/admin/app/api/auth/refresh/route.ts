import { handleBffRefresh } from "@chovia/web-ui";
import { ADMIN_BFF_CONFIG } from "../../../../lib/auth-config";

export async function POST(request: Request) {
  return handleBffRefresh(request, ADMIN_BFF_CONFIG);
}
