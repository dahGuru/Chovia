import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  mockRequestPermissions,
  mockHasServicesEnabled,
  mockGetCurrentPosition,
} = vi.hoisted(() => ({
  mockRequestPermissions: vi.fn(),
  mockHasServicesEnabled: vi.fn(),
  mockGetCurrentPosition: vi.fn(),
}));

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

vi.mock("expo-location", () => ({
  PermissionStatus: { GRANTED: "granted", DENIED: "denied" },
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: mockRequestPermissions,
  hasServicesEnabledAsync: mockHasServicesEnabled,
  getCurrentPositionAsync: mockGetCurrentPosition,
}));

import { AxiosError, AxiosHeaders } from "axios";
import { resolveApiBaseUrl } from "./env";
import { normalizeNigerianPhone } from "./validation";
import { locationService, LocationAccessError } from "../services/locationService";
import { api, normalizeApiError } from "../services/api";
import { authService } from "../services/authService";
import { riderDeliveryService } from "../services/riderDeliveryService";
import { useRiderStore } from "../store/useRiderStore";

describe("Rider Environment, Location GPS, KYC & Session Recovery", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockRequestPermissions.mockReset();
    mockHasServicesEnabled.mockReset();
    mockGetCurrentPosition.mockReset();
    useRiderStore.getState().resetSessionState();
  });

  it("diagnoses missing physical-device EXPO_PUBLIC_API_URL instead of falling back to localhost", () => {
    expect(resolveApiBaseUrl({ platformOs: "android", isDevice: false })).toBe(
      "http://10.0.2.2:4000/api/v1"
    );
    expect(() =>
      resolveApiBaseUrl({ platformOs: "ios", isDevice: true })
    ).toThrow(/Missing EXPO_PUBLIC_API_URL for physical device/i);
  });

  it("normalizes Nigerian local numbers to strict E.164", () => {
    expect(normalizeNigerianPhone("08054093095")).toBe("+2348054093095");
    expect(normalizeNigerianPhone("0805-409-3095")).toBe("+2348054093095");
    expect(normalizeNigerianPhone("12345")).toBeNull();
  });

  it("acquires real GPS coordinates when permission is granted and throws LocationAccessError when denied", async () => {
    mockRequestPermissions.mockResolvedValueOnce({ status: "denied" });
    await expect(locationService.getCurrentCoordinates()).rejects.toThrow(LocationAccessError);

    mockRequestPermissions.mockResolvedValueOnce({ status: "granted" });
    mockHasServicesEnabled.mockResolvedValueOnce(true);
    mockGetCurrentPosition.mockResolvedValueOnce({
      coords: { latitude: 6.74291, longitude: 6.13562 },
    });

    const coords = await locationService.getCurrentCoordinates();
    expect(coords).toEqual({ latitude: 6.74291, longitude: 6.13562 });
  });

  it("syncs authoritative server rider profile, online state, and active delivery cleanly", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: {
        id: "rider-prof-1",
        userId: "user-1",
        firstName: "Daniel",
        lastName: "Okafor",
        status: "ACTIVE",
        isOnline: true,
        isAvailable: false,
        lastLatitude: 6.7429,
        lastLongitude: 6.1356,
        kycStatus: "APPROVED",
        activeDeliveryCount: 1,
      },
    } as never);

    const profile = await riderDeliveryService.getMyProfile();
    useRiderStore.getState().syncFromServerProfile(profile);

    const state = useRiderStore.getState();
    expect(state.isShiftOnline).toBe(true);
    expect(state.riderStatus).toBe("ACTIVE");
    expect(state.kycStatus).toBe("APPROVED");
    expect(state.lastKnownCoordinates).toEqual({ latitude: 6.7429, longitude: 6.1356 });
  });

  it("submits KYC with extended 30s timeout and classifies timeouts, conflicts, and KYC status updates", async () => {
    const postSpy = vi.spyOn(api, "post").mockResolvedValueOnce({
      data: {
        id: "app-1",
        riderProfileId: "rider-prof-1",
        status: "UNDER_REVIEW",
        riderStatus: "PENDING",
        firstName: "Daniel",
        lastName: "Okafor",
        phone: "+2348054093095",
        operatingCity: "Ekpoma",
        vehicleType: "MOTORCYCLE",
        governmentIdType: "NIN",
        governmentIdMasked: "*******8901",
        bankName: "Access Bank",
        accountHolderName: "Daniel Okafor",
        bankAccountMasked: "******6789",
        submittedAt: "2026-11-26T10:05:00.000Z",
        documents: [],
      },
    } as never);

    const submitted = await riderDeliveryService.submitKyc({
      firstName: "Daniel",
      lastName: "Okafor",
      phone: "+2348054093095",
      operatingCity: "Ekpoma",
      vehicleType: "MOTORCYCLE",
      governmentIdType: "NIN",
      governmentIdNumber: "12345678901",
      bankName: "Access Bank",
      accountHolderName: "Daniel Okafor",
      bankAccountNumber: "0123456789",
      documents: [{ documentType: "GOVERNMENT_ID", publicId: "chovia/documents/u/id" }],
    });

    expect(submitted.status).toBe("UNDER_REVIEW");
    expect(postSpy).toHaveBeenCalledWith(
      "/riders/kyc",
      expect.any(Object),
      expect.objectContaining({ timeout: 30000 })
    );

    const kycTimeout = new AxiosError("timeout of 30000ms exceeded", "ECONNABORTED");
    expect(normalizeApiError(kycTimeout)).toMatchObject({
      code: "TIMEOUT_ERROR",
      statusCode: 0,
    });

    const lockConflict = new AxiosError("Conflict", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 409,
      statusText: "Conflict",
      headers: new AxiosHeaders(),
      config: { headers: new AxiosHeaders() },
      data: { code: "CONFLICT", message: "A KYC submission is already in progress" },
    });
    expect(normalizeApiError(lockConflict)).toMatchObject({
      statusCode: 409,
      code: "CONFLICT",
    });

    postSpy.mockResolvedValueOnce({
      data: { message: "OTP sent", signedToken: "", expiresInMinutes: 15 },
    } as never);
    const alreadyVerifiedRecovery = await authService.requestEmailVerification("rider@chovia.app");
    expect(alreadyVerifiedRecovery.signedToken).toBe("");

    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: {
        id: "rider-prof-1",
        userId: "user-1",
        firstName: "Daniel",
        lastName: "Okafor",
        status: "PENDING",
        isOnline: false,
        isAvailable: false,
        kycStatus: "REJECTED",
        kycRejectionReason: "Blurry government ID",
        activeDeliveryCount: 0,
      },
    } as never);
    const rejectedProfile = await riderDeliveryService.getMyProfile();
    expect(rejectedProfile.kycRejectionReason).toBe("Blurry government ID");
    useRiderStore.getState().syncFromServerProfile(rejectedProfile);
    expect(useRiderStore.getState().kycStatus).toBe("REJECTED");
    expect(useRiderStore.getState().riderStatus).toBe("PENDING");
    expect(useRiderStore.getState().isShiftOnline).toBe(false);
  });
});
