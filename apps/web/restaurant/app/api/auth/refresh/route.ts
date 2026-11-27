import { handleBffRefresh } from "@chovia/web-ui";
import { RESTAURANT_BFF_CONFIG } from "../../../../lib/auth-config";

export async function POST(request: Request) {
  return handleBffRefresh(request, RESTAURANT_BFF_CONFIG);
}
