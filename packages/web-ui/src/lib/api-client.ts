import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";

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

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const AUTH_BYPASS_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/restaurant/register",
  "/auth/refresh",
  "/auth/verify-email",
  "/auth/password-reset",
];

export interface PortalApiClientOptions {
  baseURL: string;
  getAccessToken: () => string | null;
  refreshSession: () => Promise<string | null>;
  onUnauthorized: () => void;
}

export function createPortalApiClient(options: PortalApiClientOptions): AxiosInstance {
  let isRefreshing = false;
  let failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (err: unknown) => void;
  }> = [];

  const processQueue = (error: unknown, token: string | null) => {
    for (const pending of failedQueue) {
      if (error || !token) {
        pending.reject(error);
      } else {
        pending.resolve(token);
      }
    }
    failedQueue = [];
  };

  const client = axios.create({
    baseURL: options.baseURL,
    timeout: 15000,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = options.getAccessToken();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  client.interceptors.response.use(
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
            return client(originalRequest);
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const newAccessToken = await options.refreshSession();
          if (!newAccessToken) {
            throw new ApiClientError(401, "SESSION_EXPIRED", "Your session has expired. Please sign in again.");
          }
          processQueue(null, newAccessToken);
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          }
          return client(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          options.onUnauthorized();
          return Promise.reject(normalizeApiError(refreshError));
        } finally {
          isRefreshing = false;
        }
      }

      return Promise.reject(normalizeApiError(error));
    }
  );

  return client;
}
