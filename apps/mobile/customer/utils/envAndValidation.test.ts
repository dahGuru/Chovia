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

import { resolveApiBaseUrl } from "./env";
import { normalizeNigerianPhone } from "./validation";
import { api } from "../services/api";
import { orderService } from "../services/orderService";

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
});
