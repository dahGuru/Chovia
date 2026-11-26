import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { authService } from "../services/authService";
import { tokenStorage } from "../services/tokenStorage";
import { useAuthStore } from "./useAuthStore";
import { useRiderStore } from "./useRiderStore";

describe("Rider Auth Role Enforcement & Delivery State", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await tokenStorage.clearTokens();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isHydrated: false,
      isLoading: false,
      error: null,
    });
    useRiderStore.setState({
      isShiftOnline: false,
      activeDelivery: null,
      sessionCompleted: [],
      declinedDeliveryIds: [],
    });
  });

  it("rejects non-RIDER accounts attempting to sign into the Rider app", async () => {
    vi.spyOn(authService, "login").mockResolvedValue({
      accessToken: "cust-token",
      refreshToken: "cust-refresh",
      user: {
        id: "22222222-2222-4222-8222-222222222222",
        email: "customer@chovia.app",
        role: "CUSTOMER",
        status: "ACTIVE",
        emailVerified: true,
        phoneVerified: false,
        createdAt: "2026-11-25T10:00:00.000Z",
      },
    });

    await expect(
      useAuthStore.getState().login({
        email: "customer@chovia.app",
        password: "Password123",
      })
    ).rejects.toThrow("Please sign in with a valid CHOVIA Rider account.");

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(await tokenStorage.getAccessToken()).toBeNull();
  });

  it("allows valid RIDER login and tracks active-to-completed delivery transitions", async () => {
    vi.spyOn(authService, "login").mockResolvedValue({
      accessToken: "rider-token",
      refreshToken: "rider-refresh",
      user: {
        id: "33333333-3333-4333-8333-333333333333",
        email: "rider@chovia.app",
        role: "RIDER",
        status: "ACTIVE",
        emailVerified: true,
        phoneVerified: true,
        firstName: "Daniel",
        lastName: "Okafor",
        createdAt: "2026-11-25T10:00:00.000Z",
      },
    });

    const user = await useAuthStore.getState().login({
      email: "rider@chovia.app",
      password: "Password123",
    });
    expect(user.role).toBe("RIDER");
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    const mockDelivery = {
      id: "44444444-4444-4444-8444-444444444444",
      orderId: "55555555-5555-4555-8555-555555555555",
      orderNumber: "CHV-1001",
      restaurantName: "Victorious Kitchen",
      restaurantAddress: "Ihumudumu Road, Ekpoma",
      deliveryAddressText: "18 Market Road, Ekpoma",
      distanceKm: 2.4,
      riderEarningsMinor: 120000,
      riderEarningsFormatted: "₦1,200.00",
      status: "ASSIGNED",
      createdAt: "2026-11-25T10:00:00.000Z",
    };

    useRiderStore.getState().setActiveDelivery(mockDelivery);
    expect(useRiderStore.getState().activeDelivery?.status).toBe("ASSIGNED");

    useRiderStore.getState().recordCompletedDelivery({ ...mockDelivery, status: "DELIVERED" });
    expect(useRiderStore.getState().activeDelivery).toBeNull();
    expect(useRiderStore.getState().sessionCompleted).toHaveLength(1);
    expect(useRiderStore.getState().sessionCompleted[0]?.status).toBe("DELIVERED");
  });
});
