export interface PortalBffAuthConfig {
  backendApiUrl: string;
  cookieName: string;
  allowedRoles: readonly string[];
  isProduction?: boolean | undefined;
  maxAgeSeconds?: number | undefined;
}

export interface PortalAuthUser {
  id: string;
  email: string;
  role: "CUSTOMER" | "RESTAURANT_STAFF" | "RIDER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
  emailVerified: boolean;
  phoneVerified: boolean;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  createdAt: string;
}

interface BackendLoginResponse {
  accessToken: string;
  refreshToken: string;
  user: PortalAuthUser;
}

const DEFAULT_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export function parseCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    if (key === name) {
      return decodeURIComponent(pair.slice(idx + 1).trim());
    }
  }
  return null;
}

export function buildRefreshCookieHeader(
  cookieName: string,
  value: string,
  options: { maxAgeSeconds: number; isProduction: boolean }
): string {
  const parts = [
    `${cookieName}=${encodeURIComponent(value)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${options.maxAgeSeconds}`,
  ];
  if (options.isProduction) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function validateSameOriginAndCsrf(request: Request): { ok: true } | { ok: false; reason: string } {
  const csrfHeader = request.headers.get("x-chovia-csrf");
  if (csrfHeader !== "1") {
    return { ok: false, reason: "Missing required CSRF protection header" };
  }

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const origin = request.headers.get("origin");
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return { ok: false, reason: "Cross-origin auth request rejected" };
      }
    } catch {
      return { ok: false, reason: "Invalid Origin header" };
    }
  } else {
    const referer = request.headers.get("referer");
    if (referer && host) {
      try {
        const refererHost = new URL(referer).host;
        if (refererHost !== host) {
          return { ok: false, reason: "Cross-origin referer rejected" };
        }
      } catch {
        return { ok: false, reason: "Invalid Referer header" };
      }
    }
  }

  return { ok: true };
}

function jsonResponse(body: unknown, status: number, setCookie?: string): Response {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  if (setCookie) {
    headers.set("Set-Cookie", setCookie);
  }
  return new Response(JSON.stringify(body), { status, headers });
}

async function revokeBackendRefreshToken(backendApiUrl: string, refreshToken: string): Promise<void> {
  await fetch(`${backendApiUrl}/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  }).catch(() => undefined);
}

export async function handleBffLogin(
  request: Request,
  config: PortalBffAuthConfig
): Promise<Response> {
  const csrfCheck = validateSameOriginAndCsrf(request);
  if (!csrfCheck.ok) {
    return jsonResponse({ code: "CSRF_FORBIDDEN", message: csrfCheck.reason }, 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ code: "VALIDATION_ERROR", message: "Invalid JSON request body" }, 400);
  }

  const email =
    body && typeof body === "object" && "email" in body && typeof body.email === "string"
      ? body.email
      : "";
  const password =
    body && typeof body === "object" && "password" in body && typeof body.password === "string"
      ? body.password
      : "";

  let backendRes: Response;
  try {
    backendRes = await fetch(`${config.backendApiUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        email,
        password,
        deviceInfo: { deviceType: "WEB", deviceName: "CHOVIA Web Portal" },
      }),
    });
  } catch {
    return jsonResponse(
      { code: "SERVICE_UNAVAILABLE", message: "Authentication service is unreachable" },
      502
    );
  }

  const payload = (await backendRes.json().catch(() => null)) as
    | BackendLoginResponse
    | { code?: string; message?: string; details?: unknown }
    | null;

  if (!backendRes.ok || !payload || !("accessToken" in payload)) {
    return jsonResponse(
      payload ?? { code: "UNAUTHORIZED", message: "Invalid credentials" },
      backendRes.status || 401
    );
  }

  if (!config.allowedRoles.includes(payload.user.role)) {
    await revokeBackendRefreshToken(config.backendApiUrl, payload.refreshToken);
    return jsonResponse(
      {
        code: "FORBIDDEN",
        message: "Your account does not have permission to access this portal.",
      },
      403
    );
  }

  const isProduction = config.isProduction ?? process.env.NODE_ENV === "production";
  const maxAgeSeconds = config.maxAgeSeconds ?? DEFAULT_COOKIE_MAX_AGE;
  const cookie = buildRefreshCookieHeader(config.cookieName, payload.refreshToken, {
    maxAgeSeconds,
    isProduction,
  });

  return jsonResponse(
    {
      accessToken: payload.accessToken,
      user: payload.user,
    },
    200,
    cookie
  );
}

export async function handleBffRefresh(
  request: Request,
  config: PortalBffAuthConfig
): Promise<Response> {
  const csrfCheck = validateSameOriginAndCsrf(request);
  if (!csrfCheck.ok) {
    return jsonResponse({ code: "CSRF_FORBIDDEN", message: csrfCheck.reason }, 403);
  }

  const isProduction = config.isProduction ?? process.env.NODE_ENV === "production";
  const clearCookie = buildRefreshCookieHeader(config.cookieName, "", {
    maxAgeSeconds: 0,
    isProduction,
  });

  const refreshToken = parseCookieValue(request.headers.get("cookie"), config.cookieName);
  if (!refreshToken) {
    return jsonResponse({ code: "NO_SESSION", message: "No active session" }, 401);
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(`${config.backendApiUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    return jsonResponse(
      { code: "SERVICE_UNAVAILABLE", message: "Authentication service is unreachable" },
      502
    );
  }

  const payload = (await backendRes.json().catch(() => null)) as
    | BackendLoginResponse
    | { code?: string; message?: string }
    | null;

  if (!backendRes.ok || !payload || !("accessToken" in payload)) {
    return jsonResponse(
      payload ?? { code: "SESSION_EXPIRED", message: "Session expired" },
      backendRes.status || 401,
      clearCookie
    );
  }

  if (!config.allowedRoles.includes(payload.user.role)) {
    await revokeBackendRefreshToken(config.backendApiUrl, payload.refreshToken);
    return jsonResponse(
      {
        code: "FORBIDDEN",
        message: "Your account does not have permission to access this portal.",
      },
      403,
      clearCookie
    );
  }

  const maxAgeSeconds = config.maxAgeSeconds ?? DEFAULT_COOKIE_MAX_AGE;
  const rotatedCookie = buildRefreshCookieHeader(config.cookieName, payload.refreshToken, {
    maxAgeSeconds,
    isProduction,
  });

  return jsonResponse(
    {
      accessToken: payload.accessToken,
      user: payload.user,
    },
    200,
    rotatedCookie
  );
}

export async function handleBffLogout(
  request: Request,
  config: PortalBffAuthConfig
): Promise<Response> {
  const csrfCheck = validateSameOriginAndCsrf(request);
  if (!csrfCheck.ok) {
    return jsonResponse({ code: "CSRF_FORBIDDEN", message: csrfCheck.reason }, 403);
  }

  const isProduction = config.isProduction ?? process.env.NODE_ENV === "production";
  const clearCookie = buildRefreshCookieHeader(config.cookieName, "", {
    maxAgeSeconds: 0,
    isProduction,
  });

  const refreshToken = parseCookieValue(request.headers.get("cookie"), config.cookieName);
  if (refreshToken) {
    await revokeBackendRefreshToken(config.backendApiUrl, refreshToken);
  }

  return jsonResponse({ success: true, message: "Signed out" }, 200, clearCookie);
}
