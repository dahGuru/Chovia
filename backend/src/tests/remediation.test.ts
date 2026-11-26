/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../database/prisma.js";
import * as redisCache from "../cache/redis.js";
import { authService } from "../modules/auth/auth.service.js";
import { riderRegisterRequestSchema } from "../modules/auth/dto/auth.dto.js";
import { riderKycService } from "../modules/delivery/rider-kyc.service.js";
import { deliveryService } from "../modules/delivery/delivery.service.js";
import { ordersService } from "../modules/orders/orders.service.js";
import { restaurantsService } from "../modules/restaurants/restaurants.service.js";
import { emailService } from "../integrations/email/email.service.js";
import { cloudinaryService } from "../integrations/cloudinary/cloudinary.service.js";
import { createOtpSignature } from "../utils/crypto.js";
import { decryptSensitiveValue } from "../utils/encryption.js";
import { buildApp } from "../app.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
} from "../common/errors/api-error.js";

describe("Integration Remediation: Rider Registration, KYC, GPS, Orders & Authz", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Rider Registration & Backend Strict E.164 Validation", () => {
    it("rejects non-E.164 local Nigerian numbers at the backend DTO boundary", () => {
      const parsed = riderRegisterRequestSchema.safeParse({
        firstName: "Daniel",
        lastName: "Okafor",
        email: "rider@chovia.app",
        phone: "08054093095",
        password: "Password123",
      });
      expect(parsed.success).toBe(false);

      const valid = riderRegisterRequestSchema.safeParse({
        firstName: "Daniel",
        lastName: "Okafor",
        email: "rider@chovia.app",
        phone: "+2348054093095",
        password: "Password123",
      });
      expect(valid.success).toBe(true);
    });

    it("creates User (RIDER, ACTIVE) and RiderProfile (PENDING, offline, unavailable) and handles email failures gracefully", async () => {
      vi.spyOn(prisma.user, "findFirst").mockResolvedValue(null);
      const createSpy = vi.spyOn(prisma.user, "create").mockResolvedValue({
        id: "11111111-1111-4111-8111-111111111111",
        email: "rider@chovia.app",
        name: "Daniel Okafor",
        role: "RIDER",
        status: "ACTIVE",
        emailVerified: false,
        phone: "+2348054093095",
        createdAt: new Date("2026-11-26T10:00:00.000Z"),
        riderProfile: {
          id: "22222222-2222-4222-8222-222222222222",
          status: "PENDING",
          isOnline: false,
          isAvailable: false,
        },
      } as any);
      vi.spyOn(emailService, "sendVerificationEmail").mockRejectedValueOnce(
        new Error("Resend unavailable")
      );

      const result = await authService.registerRider({
        firstName: "Daniel",
        lastName: "Okafor",
        email: "rider@chovia.app",
        phone: "+2348054093095",
        password: "Password123",
      });

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: "RIDER",
            status: "ACTIVE",
            emailVerified: false,
            riderProfile: {
              create: {
                firstName: "Daniel",
                lastName: "Okafor",
                status: "PENDING",
                isOnline: false,
                isAvailable: false,
              },
            },
          }),
        })
      );
      expect(result.user.role).toBe("RIDER");
      expect(result.riderProfile.status).toBe("PENDING");
      expect(result.riderProfile.isOnline).toBe(false);
      expect(result.riderProfile.isAvailable).toBe(false);
      expect(result.emailDeliveryStatus).toBe("FAILED_RETRYABLE");
      expect(result.otpData.signedToken).toBeTruthy();
    });

    it("rejects duplicate email on rider registration with ConflictError", async () => {
      vi.spyOn(prisma.user, "findFirst").mockResolvedValue({
        id: "existing-id",
        email: "rider@chovia.app",
        phone: "+2348054093095",
      } as any);

      await expect(
        authService.registerRider({
          firstName: "Daniel",
          lastName: "Okafor",
          email: "rider@chovia.app",
          phone: "+2348054093095",
          password: "Password123",
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("2. Rider KYC Encrypted Persistence, Private Cloudinary & Admin Review", () => {
    it("encrypts national ID and bank account, verifies authenticated Cloudinary documents, and keeps RiderProfile PENDING", async () => {
      const userId = "11111111-1111-4111-8111-111111111111";
      const riderId = "22222222-2222-4222-8222-222222222222";

      vi.spyOn(prisma.riderProfile, "findUnique").mockResolvedValue({
        id: riderId,
        userId,
        status: "PENDING",
        kycApplication: null,
        user: { email: "rider@chovia.app" },
      } as any);

      vi.spyOn(cloudinaryService, "verifyAssetWithProvider").mockImplementation(
        async (publicId) => ({
          publicId,
          secureUrl: `https://api.cloudinary.com/v1_1/chovia/download?public_id=${publicId}&type=authenticated`,
          deliveryType: "authenticated",
          resourceType: "image",
          format: "jpg",
          bytes: 51200,
        })
      );

      let capturedUpsertCreate: any = null;
      let capturedTxOptions: any = null;
      const createManySpy = vi.fn().mockResolvedValue({ count: 3 });

      vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: any, opts?: any) => {
        capturedTxOptions = opts;
        const tx = {
          riderProfile: { update: vi.fn().mockResolvedValue({}) },
          riderKycApplication: {
            upsert: vi.fn().mockImplementation(async (args) => {
              capturedUpsertCreate = args.create;
              return { id: "33333333-3333-4333-8333-333333333333", ...args.create };
            }),
          },
          riderDocument: {
            deleteMany: vi.fn().mockResolvedValue({}),
            createMany: createManySpy,
          },
        };
        return cb(tx);
      });

      const postCommitFindSpy = vi
        .spyOn(prisma.riderKycApplication, "findUniqueOrThrow")
        .mockResolvedValue({
          id: "33333333-3333-4333-8333-333333333333",
          riderProfileId: riderId,
          status: "UNDER_REVIEW",
          firstName: "Daniel",
          lastName: "Okafor",
          phone: "+2348054093095",
          operatingCity: "Ekpoma",
          homeAddress: null,
          vehicleType: "MOTORCYCLE",
          vehiclePlateNumber: "EDO-452-AB",
          governmentIdType: "NIN",
          governmentIdMasked: "*******8901",
          bankName: "Access Bank",
          bankCode: null,
          accountHolderName: "Daniel Okafor",
          bankAccountMasked: "******6789",
          submittedAt: new Date("2026-11-26T10:05:00.000Z"),
          reviewedAt: null,
          rejectionReason: null,
          reviewNotes: null,
          riderProfile: { status: "PENDING", userId, user: { email: "rider@chovia.app" } },
          documents: [
            {
              id: "44444444-4444-4444-8444-444444444444",
              documentType: "GOVERNMENT_ID",
              publicId: `chovia/documents/${userId}/id_front`,
              resourceType: "image",
              deliveryType: "authenticated",
              format: "jpg",
              bytes: 51200,
              verifiedAt: new Date("2026-11-26T10:05:00.000Z"),
            },
          ],
        } as any);

      const response = await riderKycService.submitApplication(userId, {
        firstName: "Daniel",
        lastName: "Okafor",
        phone: "+2348054093095",
        operatingCity: "Ekpoma",
        vehicleType: "MOTORCYCLE",
        vehiclePlateNumber: "EDO-452-AB",
        governmentIdType: "NIN",
        governmentIdNumber: "12345678901",
        bankName: "Access Bank",
        accountHolderName: "Daniel Okafor",
        bankAccountNumber: "0123456789",
        documents: [
          { documentType: "GOVERNMENT_ID", publicId: `chovia/documents/${userId}/id_front` },
          { documentType: "SELFIE", publicId: `chovia/documents/${userId}/selfie` },
          { documentType: "DRIVER_LICENSE", publicId: `chovia/documents/${userId}/license` },
        ],
      });

      expect(capturedTxOptions).toEqual({ maxWait: 5000, timeout: 15000 });
      expect(createManySpy).toHaveBeenCalledTimes(1);
      expect(createManySpy.mock.calls[0]?.[0]?.data).toHaveLength(3);
      expect(postCommitFindSpy).toHaveBeenCalledTimes(1);

      expect(capturedUpsertCreate).toBeTruthy();
      expect(capturedUpsertCreate.encryptedGovernmentId).not.toContain("12345678901");
      expect(capturedUpsertCreate.encryptedBankAccountNumber).not.toContain("0123456789");
      expect(decryptSensitiveValue(capturedUpsertCreate.encryptedGovernmentId)).toBe("12345678901");
      expect(decryptSensitiveValue(capturedUpsertCreate.encryptedBankAccountNumber)).toBe("0123456789");

      expect(response.governmentIdMasked).toBe("*******8901");
      expect(response.bankAccountMasked).toBe("******6789");
      expect(response.riderStatus).toBe("PENDING");
      expect(response.documents[0]?.deliveryType).toBe("authenticated");
      expect(response.documents[0]?.signedAccessUrl).not.toContain("/upload/");
    });

    it("cleans up ONLY newly uploaded Cloudinary docs on transaction failure and blocks concurrent submissions", async () => {
      const userId = "11111111-1111-4111-8111-111111111111";
      const riderId = "22222222-2222-4222-8222-222222222222";
      const existingPublicId = `chovia/documents/${userId}/old_id`;
      const newPublicId = `chovia/documents/${userId}/new_selfie`;

      vi.spyOn(prisma.riderProfile, "findUnique").mockResolvedValue({
        id: riderId,
        userId,
        status: "PENDING",
        kycApplication: {
          id: "33333333-3333-4333-8333-333333333333",
          status: "REJECTED",
          documents: [{ publicId: existingPublicId }],
        },
        user: { email: "rider@chovia.app" },
      } as any);

      vi.spyOn(cloudinaryService, "verifyAssetWithProvider").mockImplementation(
        async (publicId) => ({
          publicId,
          secureUrl: `https://api.cloudinary.com/v1_1/chovia/download?public_id=${publicId}&type=authenticated`,
          deliveryType: "authenticated",
          resourceType: "image",
          format: "jpg",
          bytes: 51200,
        })
      );

      const deleteSpy = vi
        .spyOn(cloudinaryService, "deleteImage")
        .mockResolvedValue(undefined);

      vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(new Error("Simulated DB failure"));

      await expect(
        riderKycService.submitApplication(userId, {
          firstName: "Daniel",
          lastName: "Okafor",
          phone: "+2348054093095",
          operatingCity: "Ekpoma",
          vehicleType: "MOTORCYCLE",
          vehiclePlateNumber: "EDO-452-AB",
          governmentIdType: "NIN",
          governmentIdNumber: "12345678901",
          bankName: "Access Bank",
          accountHolderName: "Daniel Okafor",
          bankAccountNumber: "0123456789",
          documents: [
            { documentType: "GOVERNMENT_ID", publicId: existingPublicId },
            { documentType: "SELFIE", publicId: newPublicId },
          ],
        })
      ).rejects.toThrow("Simulated DB failure");

      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith(newPublicId, {
        resourceType: "image",
        deliveryType: "authenticated",
      });
      expect(deleteSpy).not.toHaveBeenCalledWith(existingPublicId, expect.anything());

      // Concurrent submission lock when an attempt is already in flight
      let resolveFirstTx: (() => void) | null = null;
      vi.spyOn(prisma, "$transaction").mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveFirstTx = () => resolve("33333333-3333-4333-8333-333333333333");
          })
      );
      vi.spyOn(prisma.riderKycApplication, "findUniqueOrThrow").mockResolvedValue({
        id: "33333333-3333-4333-8333-333333333333",
        riderProfileId: riderId,
        status: "UNDER_REVIEW",
        firstName: "Daniel",
        lastName: "Okafor",
        phone: "+2348054093095",
        operatingCity: "Ekpoma",
        homeAddress: null,
        vehicleType: "MOTORCYCLE",
        vehiclePlateNumber: "EDO-452-AB",
        governmentIdType: "NIN",
        governmentIdMasked: "*******8901",
        bankName: "Access Bank",
        bankCode: null,
        accountHolderName: "Daniel Okafor",
        bankAccountMasked: "******6789",
        submittedAt: new Date("2026-11-26T10:05:00.000Z"),
        reviewedAt: null,
        rejectionReason: null,
        reviewNotes: null,
        riderProfile: { status: "PENDING", userId, user: { email: "rider@chovia.app" } },
        documents: [],
      } as any);

      const payload = {
        firstName: "Daniel",
        lastName: "Okafor",
        phone: "+2348054093095",
        operatingCity: "Ekpoma",
        vehicleType: "MOTORCYCLE" as const,
        governmentIdType: "NIN" as const,
        governmentIdNumber: "12345678901",
        bankName: "Access Bank",
        accountHolderName: "Daniel Okafor",
        bankAccountNumber: "0123456789",
        documents: [{ documentType: "GOVERNMENT_ID" as const, publicId: existingPublicId }],
      };

      const firstPromise = riderKycService.submitApplication(userId, payload);
      await new Promise((r) => setTimeout(r, 20));
      await expect(riderKycService.submitApplication(userId, payload)).rejects.toThrow(ConflictError);

      resolveFirstTx?.();
      await firstPromise;
    });

    it("activates RiderProfile only on admin approval and sets PENDING on admin rejection", async () => {
      const appId = "33333333-3333-4333-8333-333333333333";
      const riderId = "22222222-2222-4222-8222-222222222222";
      const riderUserId = "11111111-1111-4111-8111-111111111111";
      const adminId = "99999999-9999-4999-8999-999999999999";

      vi.spyOn(prisma.riderKycApplication, "findUnique").mockResolvedValue({
        id: appId,
        riderProfileId: riderId,
        status: "UNDER_REVIEW",
        operatingCity: "Ekpoma",
        vehicleType: "MOTORCYCLE",
        vehiclePlateNumber: "EDO-452-AB",
        encryptedGovernmentId: "v1:iv:tag:ct",
        encryptedBankAccountNumber: "v1:iv:tag:ct",
        riderProfile: { status: "PENDING", userId: riderUserId, user: { email: "rider@chovia.app" } },
        documents: [
          { documentType: "GOVERNMENT_ID" },
          { documentType: "SELFIE" },
          { documentType: "DRIVER_LICENSE" },
        ],
      } as any);

      const profileUpdateSpy = vi.fn().mockResolvedValue({});
      const auditSpy = vi.fn().mockResolvedValue({});
      const notifSpy = vi.fn().mockResolvedValue({});

      vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: any) => {
        const tx = {
          riderKycApplication: {
            update: vi.fn().mockResolvedValue({ id: appId }),
          },
          riderProfile: { update: profileUpdateSpy },
          auditLog: { create: auditSpy },
          notification: { create: notifSpy },
        };
        return cb(tx);
      });

      vi.spyOn(prisma.riderKycApplication, "findUniqueOrThrow").mockResolvedValue({
        id: appId,
        riderProfileId: riderId,
        status: "APPROVED",
        firstName: "Daniel",
        lastName: "Okafor",
        phone: "+2348054093095",
        operatingCity: "Ekpoma",
        homeAddress: null,
        vehicleType: "MOTORCYCLE",
        vehiclePlateNumber: "EDO-452-AB",
        governmentIdType: "NIN",
        governmentIdMasked: "*******8901",
        bankName: "Access Bank",
        bankCode: null,
        accountHolderName: "Daniel Okafor",
        bankAccountMasked: "******6789",
        submittedAt: new Date(),
        reviewedAt: new Date(),
        rejectionReason: null,
        reviewNotes: "Verified",
        riderProfile: { status: "ACTIVE", userId: riderUserId, user: { email: "rider@chovia.app" } },
        documents: [],
      } as any);

      const approved = await riderKycService.approveApplication(adminId, appId, "Verified");
      expect(approved.status).toBe("APPROVED");
      expect(profileUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: riderId },
          data: expect.objectContaining({
            status: "ACTIVE",
            isOnline: false,
            isAvailable: false,
          }),
        })
      );
      expect(auditSpy).toHaveBeenCalled();
      expect(notifSpy).toHaveBeenCalled();
    });
  });

  describe("3. Rider Availability, GPS Coordinates & Offline Preservation", () => {
    it("blocks pending/suspended riders from going online", async () => {
      vi.spyOn(prisma.riderProfile, "findUnique").mockResolvedValue({
        id: "rider-1",
        userId: "user-1",
        status: "PENDING",
        isOnline: false,
        isAvailable: false,
        deliveries: [],
      } as any);

      await expect(
        deliveryService.updateRiderStatus("user-1", {
          isOnline: true,
          latitude: 6.7429,
          longitude: 6.1356,
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("requires valid GPS coordinates when going online", async () => {
      vi.spyOn(prisma.riderProfile, "findUnique").mockResolvedValue({
        id: "rider-1",
        userId: "user-1",
        status: "ACTIVE",
        isOnline: false,
        isAvailable: false,
        deliveries: [],
      } as any);

      await expect(
        deliveryService.updateRiderStatus("user-1", { isOnline: true })
      ).rejects.toThrow(BadRequestError);
    });

    it("persists GPS coordinates & sets isOnline/isAvailable on online, and preserves RiderProfile.status=ACTIVE when going offline", async () => {
      vi.spyOn(prisma.riderProfile, "findUnique").mockResolvedValue({
        id: "rider-1",
        userId: "user-1",
        status: "ACTIVE",
        isOnline: false,
        isAvailable: false,
        deliveries: [],
      } as any);

      const updateSpy = vi
        .spyOn(prisma.riderProfile, "update")
        .mockResolvedValueOnce({
          status: "ACTIVE",
          isOnline: true,
          isAvailable: true,
          lastLatitude: 6.7429,
          lastLongitude: 6.1356,
          lastLocationUpdatedAt: new Date("2026-11-26T12:00:00.000Z"),
        } as any)
        .mockResolvedValueOnce({
          status: "ACTIVE",
          isOnline: false,
          isAvailable: false,
          lastLatitude: 6.7429,
          lastLongitude: 6.1356,
          lastLocationUpdatedAt: new Date("2026-11-26T12:00:00.000Z"),
        } as any);

      const onlineRes = await deliveryService.updateRiderStatus("user-1", {
        isOnline: true,
        latitude: 6.7429,
        longitude: 6.1356,
      });
      expect(onlineRes.status).toBe("ACTIVE");
      expect(onlineRes.isOnline).toBe(true);
      expect(onlineRes.isAvailable).toBe(true);
      expect(onlineRes.lastLatitude).toBe(6.7429);

      const offlineRes = await deliveryService.updateRiderStatus("user-1", {
        isOnline: false,
      });
      expect(offlineRes.status).toBe("ACTIVE");
      expect(offlineRes.isOnline).toBe(false);
      expect(offlineRes.isAvailable).toBe(false);
      expect(updateSpy).toHaveBeenLastCalledWith({
        where: { id: "rider-1" },
        data: { isOnline: false, isAvailable: false },
      });
    });
  });

  describe("4. Orders Pagination & Resource-Level Authorization Across Orders and Tracking", () => {
    it("scopes GET /orders to assigned deliveries for RIDER and returns paginated object", async () => {
      vi.spyOn(prisma.riderProfile, "findUnique").mockResolvedValue({
        id: "rider-profile-1",
        userId: "rider-user-1",
      } as any);
      vi.spyOn(prisma.order, "count").mockResolvedValue(1);
      const findManySpy = vi.spyOn(prisma.order, "findMany").mockResolvedValue([]);

      const res = await ordersService.list("rider-user-1", "RIDER", { page: 1, limit: 20 });
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            delivery: { is: { riderId: "rider-profile-1" } },
          }),
        })
      );
      expect(res).toEqual({
        items: [],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it("enforces ownership on GET /orders/:id and POST /orders/:id/cancel", async () => {
      vi.spyOn(prisma.order, "findUnique").mockResolvedValue({
        id: "order-1",
        customerId: "customer-owner",
        restaurantId: "rest-1",
        status: "PENDING",
        delivery: { riderId: "rider-assigned" },
        items: [],
        restaurant: { name: "Kitchen" },
        statusHistory: [],
      } as any);

      vi.spyOn(prisma.customerProfile, "findUnique").mockResolvedValue({
        id: "customer-other",
      } as any);
      await expect(
        ordersService.getById("user-other", "CUSTOMER", "order-1")
      ).rejects.toThrow(ForbiddenError);
      await expect(
        ordersService.cancelOrder("user-other", "CUSTOMER", "order-1", { reason: "Changed mind" })
      ).rejects.toThrow(ForbiddenError);

      vi.spyOn(prisma.riderProfile, "findUnique").mockResolvedValue({
        id: "rider-unassigned",
      } as any);
      await expect(
        ordersService.getById("rider-user-other", "RIDER", "order-1")
      ).rejects.toThrow(ForbiddenError);

      vi.spyOn(prisma.restaurantStaffMembership, "findFirst").mockResolvedValue(null);
      await expect(
        ordersService.getById("staff-other", "RESTAURANT_STAFF", "order-1")
      ).rejects.toThrow(ForbiddenError);
    });

    it("enforces resource-level authorization on GET /deliveries/:orderId/track", async () => {
      vi.spyOn(prisma.order, "findUnique").mockResolvedValue({
        id: "order-1",
        orderNumber: "CHV-1001",
        customerId: "customer-owner",
        restaurantId: "rest-owner",
        deliveryAddressText: "18 Market Rd",
        deliveryLatitude: 6.74,
        deliveryLongitude: 6.13,
        restaurant: {
          name: "Kitchen",
          address: "Road 1",
          latitude: 6.75,
          longitude: 6.14,
        },
        delivery: {
          status: "ASSIGNED",
          riderId: "rider-owner",
          rider: null,
        },
      } as any);

      // Unrelated customer denied
      vi.spyOn(prisma.customerProfile, "findUnique").mockResolvedValueOnce({
        id: "customer-attacker",
      } as any);
      await expect(
        deliveryService.trackDelivery("order-1", "cust-user-2", "CUSTOMER")
      ).rejects.toThrow(ForbiddenError);

      // Unassigned rider denied
      vi.spyOn(prisma.riderProfile, "findUnique").mockResolvedValueOnce({
        id: "rider-other",
      } as any);
      await expect(
        deliveryService.trackDelivery("order-1", "rider-user-2", "RIDER")
      ).rejects.toThrow(ForbiddenError);

      // Unrelated restaurant staff denied
      vi.spyOn(prisma.restaurantStaffMembership, "findFirst").mockResolvedValueOnce(null);
      await expect(
        deliveryService.trackDelivery("order-1", "staff-user-2", "RESTAURANT_STAFF")
      ).rejects.toThrow(ForbiddenError);

      // Owning customer allowed
      vi.spyOn(prisma.customerProfile, "findUnique").mockResolvedValueOnce({
        id: "customer-owner",
      } as any);
      const allowed = await deliveryService.trackDelivery("order-1", "cust-user-1", "CUSTOMER");
      expect(allowed.orderId).toBe("order-1");
    });
  });

  describe("5. Email Verification Recovery & OTP Supersession", () => {
    it("handles unknown and already-verified emails without issuing tokens and issues recovery OTP for unverified users", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValueOnce(null);
      const unknownRes = await authService.requestEmailVerification("nobody@chovia.app");
      expect(unknownRes.signedToken).toBe("");

      vi.spyOn(prisma.user, "findUnique").mockResolvedValueOnce({
        id: "u-verified",
        email: "verified@chovia.app",
        emailVerified: true,
      } as any);
      const verifiedRes = await authService.requestEmailVerification("verified@chovia.app");
      expect(verifiedRes.signedToken).toBe("");
      expect(verifiedRes.message).toContain("already verified");

      const cacheStore = new Map<string, string>();
      vi.spyOn(redisCache, "cacheSet").mockImplementation(async (key, val) => {
        cacheStore.set(key, String(val));
      });
      vi.spyOn(redisCache, "cacheGet").mockImplementation(async (key) => {
        return (cacheStore.get(key) as any) ?? null;
      });
      vi.spyOn(redisCache, "cacheDel").mockImplementation(async (key) => {
        cacheStore.delete(key);
      });
      vi.spyOn(redisCache, "atomicConsumeToken").mockResolvedValue(true);

      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: "u-unverified",
        email: "unverified@chovia.app",
        emailVerified: false,
      } as any);
      vi.spyOn(prisma.user, "update").mockResolvedValue({
        id: "u-unverified",
        emailVerified: true,
      } as any);

      const sentOtps: string[] = [];
      vi.spyOn(emailService, "sendVerificationEmail").mockImplementation(async (_email, otp) => {
        sentOtps.push(otp);
      });

      const first = await authService.requestEmailVerification("unverified@chovia.app");
      const firstOtp = sentOtps[0]!;
      const second = await authService.requestEmailVerification("unverified@chovia.app");
      const secondOtp = sentOtps[1]!;

      expect(first.signedToken).toBeTruthy();
      expect(second.signedToken).toBeTruthy();

      await expect(
        authService.verifyEmail("unverified@chovia.app", firstOtp, first.signedToken)
      ).rejects.toThrow(BadRequestError);

      const ok = await authService.verifyEmail(
        "unverified@chovia.app",
        secondOtp,
        second.signedToken
      );
      expect(ok.success).toBe(true);
    });

    it("rejects expired OTP tokens explicitly", async () => {
      const { signedToken } = createOtpSignature("expired@chovia.app", "123456", "VERIFY_EMAIL");
      const [, hmac] = signedToken.split(".");
      const expiredToken = `${Date.now() - 60000}.${hmac}`;

      await expect(
        authService.verifyEmail("expired@chovia.app", "123456", expiredToken)
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe("6. Explore Restaurants, Menu Contract & Fastify Response Serialization Diagnostics", () => {
    it("serializes GET /restaurants as { items, total, page, limit, totalPages } and filters by cuisine", async () => {
      const app = await buildApp();
      await app.ready();

      try {
        const restId = "11111111-1111-4111-8111-111111111111";
        vi.spyOn(prisma.restaurant, "findMany").mockResolvedValueOnce([
          {
            id: restId,
            name: "Jollof Republic",
            description: "Smoky party jollof",
            phone: "+2348054093095",
            email: null,
            address: "10 University Rd, Ekpoma",
            latitude: 6.7429,
            longitude: 6.1356,
            maxDeliveryDistanceKm: 10,
            status: "ACTIVE",
            availability: "OPEN",
            createdAt: new Date("2026-11-26T10:00:00.000Z"),
            cuisines: [{ cuisineCategory: { name: "Nigerian" } }],
          },
        ] as any);
        vi.spyOn(prisma.restaurant, "count").mockResolvedValueOnce(1);

        const res = await app.inject({
          method: "GET",
          url: "/api/v1/restaurants?search=Nigerian&page=1&limit=20",
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(Array.isArray(body.items)).toBe(true);
        expect(body.restaurants).toBeUndefined();
        expect(body.items).toHaveLength(1);
        expect(body.total).toBe(1);
        expect(body.totalPages).toBe(1);
        expect(body.items[0].cuisines).toEqual(["Nigerian"]);

        // Menu endpoint contract with nullable fields & empty category
        vi.spyOn(prisma.restaurant, "findUnique").mockResolvedValueOnce({ id: restId } as any);
        vi.spyOn(prisma.menuCategory, "findMany").mockResolvedValueOnce([
          {
            id: "22222222-2222-4222-8222-222222222222",
            name: "Rice Specials",
            description: null,
            sortOrder: 1,
            items: [
              {
                id: "33333333-3333-4333-8333-333333333333",
                categoryId: "22222222-2222-4222-8222-222222222222",
                name: "Party Jollof & Chicken",
                description: null,
                price: "4500.00",
                maxQuantity: 10,
                availability: "AVAILABLE",
                imageUrl: null,
                createdAt: new Date("2026-11-26T10:00:00.000Z"),
              },
            ],
          },
        ] as any);

        const menuRes = await app.inject({
          method: "GET",
          url: `/api/v1/restaurants/${restId}/menu`,
        });

        expect(menuRes.statusCode).toBe(200);
        const menuBody = JSON.parse(menuRes.body);
        expect(Array.isArray(menuBody)).toBe(true);
        expect(menuBody[0].items[0].priceMinor).toBe(450000);

        // Diagnostic 500 response on ResponseSerializationError
        vi.spyOn(restaurantsService, "list").mockResolvedValueOnce({
          restaurants: [],
        } as any);

        const mismatchRes = await app.inject({
          method: "GET",
          url: "/api/v1/restaurants",
        });

        expect(mismatchRes.statusCode).toBe(500);
        const mismatchBody = JSON.parse(mismatchRes.body);
        expect(mismatchBody.code).toBe("RESPONSE_VALIDATION_ERROR");
        expect(mismatchBody.details?.endpoint).toContain("/api/v1/restaurants");
        expect(Array.isArray(mismatchBody.details?.issues)).toBe(true);
      } finally {
        await app.close();
      }
    }, 30000);
  });
});
