import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { ENV } from "../utils/env";
import { tokenStorage } from "./tokenStorage";

export interface BackendErrorPayload {
  statusCode?: number;
  code?: string;
  message?: string;
  details?: unknown;
  timestamp?: string;
}

export class ApiClientError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function defaultCodeForStatus(status: number, isTimeout: boolean): string {
  if (isTimeout) return "TIMEOUT_ERROR";
  if (status === 0) return "NETWORK_ERROR";
  if (status === 400 || status === 422) return "VALIDATION_ERROR";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 429) return "RATE_LIMIT_EXCEEDED";
  if (status === 502 || status === 503 || status === 504) return "SERVICE_UNAVAILABLE";
  if (status >= 500) return "INTERNAL_SERVER_ERROR";
  return "API_ERROR";
}

function defaultMessageForStatus(status: number, isTimeout: boolean, fallback: string): string {
  if (isTimeout) {
    return "The request took too long to complete. Please try again.";
  }
  if (status === 0) {
    return "Unable to reach the server. Please check your connection.";
  }
  if (status === 429) {
    return "Too many requests. Please wait a moment and try again.";
  }
  if (status === 502 || status === 503 || status === 504) {
    return "The server is temporarily unavailable. Please try again shortly.";
  }
  return fallback || "An unexpected error occurred";
}

export function normalizeApiError(error: unknown): ApiClientError {
  if (error instanceof ApiClientError) {
    return error;
  }
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 0;
    const isTimeout =
      error.code === "ECONNABORTED" ||
      error.code === "ETIMEDOUT" ||
      (status === 0 && /timeout/i.test(error.message ?? ""));
    const rawData = error.response?.data;
    const data =
      rawData && typeof rawData === "object"
        ? (rawData as BackendErrorPayload)
        : undefined;
    const code = data?.code ?? defaultCodeForStatus(status, isTimeout);
    const message =
      (typeof data?.message === "string" && data.message.trim().length > 0
        ? data.message
        : undefined) ??
      defaultMessageForStatus(status, isTimeout, error.message);
    return new ApiClientError(status, code, message, data?.details);
  }
  if (error instanceof Error) {
    return new ApiClientError(0, "UNKNOWN_ERROR", error.message);
  }
  return new ApiClientError(0, "UNKNOWN_ERROR", "An unexpected error occurred");
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function registerUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let isRefreshing = false;
let failedQueue: {
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}[] = [];

function processQueue(error: unknown, token: string | null): void {
  for (const pending of failedQueue) {
    if (error || !token) {
      pending.reject(error);
    } else {
      pending.resolve(token);
    }
  }
  failedQueue = [];
}

export const api = axios.create({
  baseURL: ENV.apiBaseUrl,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (ENV.configError || !ENV.apiBaseUrl) {
      return Promise.reject(
        new ApiClientError(0, "ENV_CONFIGURATION_ERROR", ENV.configError || "API URL is not configured.")
      );
    }
    const token = await tokenStorage.getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

const AUTH_BYPASS_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/rider/register",
  "/auth/refresh",
  "/auth/verify-email",
  "/auth/password-reset",
];

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<BackendErrorPayload>) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;
    const status = error.response?.status;
    const requestUrl = originalRequest?.url ?? "";
    const isBypassed = AUTH_BYPASS_PATHS.some((path) => requestUrl.includes(path));

    if (status === 401 && originalRequest && !originalRequest._retry && !isBypassed) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((newToken) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await tokenStorage.getRefreshToken();
        if (!refreshToken) {
          throw new ApiClientError(401, "NO_REFRESH_TOKEN", "Session expired");
        }

        const refreshResponse = await axios.post<{
          accessToken: string;
          refreshToken: string;
        }>(
          `${ENV.apiBaseUrl}/auth/refresh`,
          { refreshToken },
          {
            timeout: 15000,
            headers: { "Content-Type": "application/json" },
          }
        );

        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = refreshResponse.data;
        await tokenStorage.setTokens(newAccessToken, newRefreshToken);
        processQueue(null, newAccessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await tokenStorage.clearTokens();
        unauthorizedHandler?.();
        return Promise.reject(normalizeApiError(refreshError));
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(normalizeApiError(error));
  }
);
