import { handleBffLogin } from "@chovia/web-ui";
import { ADMIN_BFF_CONFIG } from "../../../../lib/auth-config";

export async function POST(request: Request) {
  return handleBffLogin(request, ADMIN_BFF_CONFIG);
}
