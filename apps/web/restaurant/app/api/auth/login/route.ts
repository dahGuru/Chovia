import { handleBffLogin } from "@chovia/web-ui";
import { RESTAURANT_BFF_CONFIG } from "../../../../lib/auth-config";

export async function POST(request: Request) {
  return handleBffLogin(request, RESTAURANT_BFF_CONFIG);
}
