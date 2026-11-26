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
import { formatNairaFromMinor, getOrderStatusMeta } from "../utils/formatters";

describe("Customer Foundation & Auth Integration", () => {
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
  });

  it("logs in customer, stores tokens securely, and populates user state", async () => {
    const mockUser = {
      id: "11111111-1111-4111-8111-111111111111",
      email: "ada@chovia.app",
      role: "CUSTOMER" as const,
      status: "ACTIVE" as const,
      emailVerified: true,
      phoneVerified: false,
      firstName: "Ada",
      lastName: "Obi",
      phone: "+2348012345678",
      createdAt: "2026-11-25T10:00:00.000Z",
    };

    vi.spyOn(authService, "login").mockResolvedValue({
      accessToken: "access-token-123",
      refreshToken: "refresh-token-456",
      user: mockUser,
    });

    const user = await useAuthStore.getState().login({
      email: "ada@chovia.app",
      password: "Password123",
    });

    expect(user.email).toBe("ada@chovia.app");
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(await tokenStorage.getAccessToken()).toBe("access-token-123");
    expect(await tokenStorage.getRefreshToken()).toBe("refresh-token-456");
  });

  it("clears tokens and resets state on logout", async () => {
    await tokenStorage.setTokens("a", "r");
    vi.spyOn(authService, "logout").mockResolvedValue({ message: "ok", success: true });

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(await tokenStorage.getAccessToken()).toBeNull();
    expect(await tokenStorage.getRefreshToken()).toBeNull();
  });

  it("formats NGN minor units and order statuses accurately", () => {
    expect(formatNairaFromMinor(750000)).toBe("₦7,500.00");
    expect(getOrderStatusMeta("OUT_FOR_DELIVERY").label).toBe("On the Way");
    expect(getOrderStatusMeta("DELIVERED").label).toBe("Delivered");
  });
});
