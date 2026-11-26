import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "web" },
}));

vi.mock("expo-constants", () => ({
  default: { isDevice: false },
}));

vi.mock("expo-secure-store", () => ({
  setItemAsync: vi.fn(),
  getItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

import { AxiosError, AxiosHeaders } from "axios";
import { resolveApiBaseUrl } from "./env";
import { normalizeNigerianPhone } from "./validation";
import { api, ApiClientError, normalizeApiError } from "../services/api";
import { authService } from "../services/authService";
import { orderService } from "../services/orderService";
import { restaurantService } from "../services/restaurantService";

describe("Customer Environment Resolution, Phone Normalization & Paginated Orders", () => {
  it("resolves platform-specific default API URLs and rejects physical devices without EXPO_PUBLIC_API_URL", () => {
    expect(resolveApiBaseUrl({ platformOs: "android", isDevice: false })).toBe(
      "http://10.0.2.2:4000/api/v1"
    );
    expect(resolveApiBaseUrl({ platformOs: "ios", isDevice: false })).toBe(
      "http://localhost:4000/api/v1"
    );
    expect(resolveApiBaseUrl({ platformOs: "web", isDevice: false })).toBe(
      "http://localhost:4000/api/v1"
    );
    expect(
      resolveApiBaseUrl({
        envUrl: "http://192.168.1.50:4000/api/v1/",
        platformOs: "ios",
        isDevice: true,
      })
    ).toBe("http://192.168.1.50:4000/api/v1");

    expect(() =>
      resolveApiBaseUrl({ platformOs: "android", isDevice: true })
    ).toThrow(/Missing EXPO_PUBLIC_API_URL for physical device/i);

    expect(() =>
      resolveApiBaseUrl({ envUrl: "not-a-url", platformOs: "android", isDevice: true })
    ).toThrow(/Invalid EXPO_PUBLIC_API_URL/i);
  });

  it("normalizes Nigerian local numbers to strict E.164 and rejects malformed numbers", () => {
    expect(normalizeNigerianPhone("08054093095")).toBe("+2348054093095");
    expect(normalizeNigerianPhone("0805 409 3095")).toBe("+2348054093095");
    expect(normalizeNigerianPhone("2348054093095")).toBe("+2348054093095");
    expect(normalizeNigerianPhone("+2348054093095")).toBe("+2348054093095");
    expect(normalizeNigerianPhone("+14155552671")).toBe("+14155552671");

    expect(normalizeNigerianPhone("08054")).toBeNull();
    expect(normalizeNigerianPhone("+23408054093095")).toBeNull();
    expect(normalizeNigerianPhone("invalid-phone")).toBeNull();
  });

  it("consumes the aligned paginated GET /orders contract cleanly", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: {
        items: [
          {
            id: "order-1",
            orderNumber: "CHV-1001",
            restaurantId: "rest-1",
            restaurantName: "Victorious Kitchen",
            customerId: "cust-1",
            status: "CONFIRMED",
            subtotalMinor: 300000,
            subtotalFormatted: "₦3,000.00",
            deliveryFeeMinor: 50000,
            deliveryFeeFormatted: "₦500.00",
            totalAmountMinor: 350000,
            totalAmountFormatted: "₦3,500.00",
            deliveryAddressText: "18 Market Rd",
            items: [],
            createdAt: "2026-11-26T10:00:00.000Z",
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    } as never);

    const items = await orderService.list({ page: 1 });
    expect(items).toHaveLength(1);
    expect(items[0]?.orderNumber).toBe("CHV-1001");
  });

  it("validates paginated GET /restaurants (items + totalPages), search/cuisine filtering, empty state, and schema diagnostics", async () => {
    const getSpy = vi.spyOn(api, "get").mockResolvedValueOnce({
      data: {
        items: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            name: "Mama Put Express",
            description: null,
            phone: "+2348054093095",
            email: null,
            address: "18 Market Rd, Ekpoma",
            latitude: 6.7429,
            longitude: 6.1356,
            maxDeliveryDistanceKm: 10,
            status: "ACTIVE",
            availability: "OPEN",
            distanceKm: 1.4,
            cuisines: ["Nigerian", "Rice"],
            createdAt: "2026-11-26T10:00:00.000Z",
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    } as never);

    const listRes = await restaurantService.list({
      search: "Rice",
      cuisineId: "22222222-2222-4222-8222-222222222222",
      page: 1,
      limit: 20,
    });
    expect(getSpy).toHaveBeenCalledWith("/restaurants", {
      params: {
        search: "Rice",
        cuisineId: "22222222-2222-4222-8222-222222222222",
        page: 1,
        limit: 20,
      },
    });
    expect(listRes.items).toHaveLength(1);
    expect(listRes.totalPages).toBe(1);

    getSpy.mockResolvedValueOnce({
      data: { items: [], total: 0, page: 1, limit: 20, totalPages: 0 },
    } as never);
    const emptyRes = await restaurantService.list({ search: "NonExistent" });
    expect(emptyRes.items).toEqual([]);
    expect(emptyRes.total).toBe(0);

    getSpy.mockResolvedValueOnce({
      data: { restaurants: [], total: 0, page: 1, limit: 20 },
    } as never);
    await expect(restaurantService.list()).rejects.toMatchObject({
      code: "RESPONSE_SCHEMA_ERROR",
      details: {
        endpoint: "GET /restaurants",
      },
    });
  });

  it("validates GET /restaurants/:id/menu categories and reports invalid menu shapes cleanly", async () => {
    const restId = "11111111-1111-4111-8111-111111111111";
    const getSpy = vi.spyOn(api, "get").mockResolvedValueOnce({
      data: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          name: "Swallows & Soups",
          description: null,
          sortOrder: 1,
          items: [
            {
              id: "44444444-4444-4444-8444-444444444444",
              categoryId: "33333333-3333-4333-8333-333333333333",
              name: "Pounded Yam & Egusi",
              description: null,
              priceMinor: 350000,
              priceFormatted: "₦3,500.00",
              maxQuantity: 10,
              availability: "AVAILABLE",
              imageUrl: null,
              createdAt: "2026-11-26T10:00:00.000Z",
            },
          ],
        },
      ],
    } as never);

    const categories = await restaurantService.getMenu(restId);
    expect(categories).toHaveLength(1);
    expect(categories[0]?.items[0]?.priceMinor).toBe(350000);

    getSpy.mockResolvedValueOnce({
      data: [{ id: "not-a-uuid", name: "Broken" }],
    } as never);
    await expect(restaurantService.getMenu(restId)).rejects.toBeInstanceOf(ApiClientError);
  });

  it("supports email verification recovery and distinguishes timeout/network/conflict/rate-limit errors", async () => {
    const postSpy = vi
      .spyOn(api, "post")
      .mockResolvedValueOnce({
        data: { message: "OTP sent", signedToken: "signed.hmac", expiresInMinutes: 15 },
      } as never)
      .mockResolvedValueOnce({
        data: { message: "Verified", success: true },
      } as never);

    const recovery = await authService.requestEmailVerification("customer@chovia.app");
    expect(recovery.signedToken).toBe("signed.hmac");
    const verified = await authService.verifyEmail({
      email: "customer@chovia.app",
      otp: "123456",
      signedToken: recovery.signedToken,
    });
    expect(verified.success).toBe(true);
    expect(postSpy).toHaveBeenCalledTimes(2);

    const timeoutErr = new AxiosError("timeout of 15000ms exceeded", "ECONNABORTED");
    expect(normalizeApiError(timeoutErr)).toMatchObject({
      code: "TIMEOUT_ERROR",
      statusCode: 0,
    });

    const offlineErr = new AxiosError("Network Error", "ERR_NETWORK");
    expect(normalizeApiError(offlineErr)).toMatchObject({
      code: "NETWORK_ERROR",
      statusCode: 0,
    });

    const conflictErr = new AxiosError("Conflict", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 409,
      statusText: "Conflict",
      headers: new AxiosHeaders(),
      config: { headers: new AxiosHeaders() },
      data: { code: "CONFLICT", message: "Email is already registered" },
    });
    expect(normalizeApiError(conflictErr)).toMatchObject({
      statusCode: 409,
      code: "CONFLICT",
      message: "Email is already registered",
    });

    const throttleErr = new AxiosError("Too Many Requests", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 429,
      statusText: "Too Many Requests",
      headers: new AxiosHeaders(),
      config: { headers: new AxiosHeaders() },
      data: {},
    });
    expect(normalizeApiError(throttleErr)).toMatchObject({
      statusCode: 429,
      code: "RATE_LIMIT_EXCEEDED",
    });
  });
});
