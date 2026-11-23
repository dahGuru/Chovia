/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import type { Job } from "bullmq";
import {
  enqueueVerificationEmail,
  enqueuePasswordResetEmail,
  enqueueStaffInviteEmail,
  enqueuePushNotification,
  enqueueDeliveryTimeoutCheck,
  createOpaqueJobId,
} from "../jobs/queues/index.js";
import { emailService } from "../integrations/email/email.service.js";
import { resendService } from "../integrations/resend/resend.service.js";
import { processEmailJob } from "../jobs/processors/email.processor.js";
import { JOB_NAMES } from "../jobs/constants/jobs.constants.js";
import { cloudinaryService, UPLOAD_POLICIES } from "../integrations/cloudinary/cloudinary.service.js";
import { BadRequestError } from "../common/errors/api-error.js";
import { outboxDispatcher } from "../jobs/outbox/outbox.dispatcher.js";
import { processDeliveryJob } from "../jobs/processors/delivery.processor.js";
import { expoPushService, isExpoPushToken } from "../integrations/expo/expo-push.service.js";
import { prisma } from "../database/prisma.js";

describe("BullMQ Queues Error Propagation & Deterministic Job IDs", () => {
  it("should throw explicit error when queue is unavailable instead of silently swallowing", async () => {
    // In test environment, getEmailQueue() returns null by default to protect local testing
    await expect(
      enqueueVerificationEmail({ email: "test@chovia.app", otp: "123456" })
    ).rejects.toThrow(/Email queue is unavailable/i);

    await expect(
      enqueuePasswordResetEmail({ email: "test@chovia.app", otp: "654321" })
    ).rejects.toThrow(/Email queue is unavailable/i);

    await expect(
      enqueueStaffInviteEmail({
        email: "staff@chovia.app",
        restaurantName: "Test Kitchen",
        role: "RESTAURANT_STAFF",
        inviteToken: "inv_12345",
      })
    ).rejects.toThrow(/Email queue is unavailable/i);

    await expect(
      enqueuePushNotification({
        userId: "usr_123",
        title: "Order Update",
        body: "Your order is ready",
      })
    ).rejects.toThrow(/Notification queue is unavailable/i);

    await expect(
      enqueueDeliveryTimeoutCheck({
        deliveryId: "del_123",
        orderId: "ord_123",
      })
    ).rejects.toThrow(/Delivery queue is unavailable/i);
  });

  it("should seamlessly fallback to direct Resend delivery when queue is bypassed or unavailable", async () => {
    const resendSpy = vi.spyOn(resendService, "sendVerificationOtp").mockResolvedValue({
      id: "mock_resend_email_id_123",
      success: true,
    });

    await emailService.sendVerificationEmail("fallback@chovia.app", "987654");
    expect(resendSpy).toHaveBeenCalledWith("fallback@chovia.app", "987654");

    resendSpy.mockRestore();
  });

  it("should process email worker job by dispatching directly to Resend without recursive loop", async () => {
    const resendSpy = vi.spyOn(resendService, "sendVerificationOtp").mockResolvedValue({
      id: "mock_resend_email_id_456",
      success: true,
    });

    const mockJob = {
      name: JOB_NAMES.SEND_VERIFICATION_EMAIL,
      data: { email: "worker@chovia.app", otp: "112233" },
    } as unknown as Parameters<typeof processEmailJob>[0];

    await processEmailJob(mockJob);
    expect(resendSpy).toHaveBeenCalledWith("worker@chovia.app", "112233");

    resendSpy.mockRestore();
  });
});

describe("Cloudinary Upload Restrictions & Provider-Level Policies", () => {
  it("should enforce distinct category upload policies", () => {
    expect(UPLOAD_POLICIES.avatars.maxSizeBytes).toBe(5 * 1024 * 1024);
    expect(UPLOAD_POLICIES.menu.maxSizeBytes).toBe(5 * 1024 * 1024);
    expect(UPLOAD_POLICIES.documents.maxSizeBytes).toBe(10 * 1024 * 1024);
    expect(UPLOAD_POLICIES.documents.allowedFormats).toContain("pdf");
    expect(UPLOAD_POLICIES.menu.allowedFormats).not.toContain("pdf");
  });

  it("should generate upload signature containing signed provider-level restrictions", () => {
    const sig = cloudinaryService.generateUploadSignature("menu", "custom_item_99");
    expect(sig.signature).toBeDefined();
    expect(sig.folder).toBe("chovia/menu");
    expect(sig.allowedFormats).toEqual(["jpg", "jpeg", "png", "webp"]);
    expect(sig.maxFileSize).toBe(5 * 1024 * 1024);
    expect(sig.resourceType).toBe("image");
  });

  it("should verify upload response against expected folder, format, and size limit", () => {
    // Valid upload response
    expect(() => {
      cloudinaryService.verifyUploadResponse("menu", {
        publicId: "chovia/menu/item_123",
        format: "webp",
        bytes: 1024000,
        resourceType: "image",
      });
    }).not.toThrow();

    // Mismatched folder
    expect(() => {
      cloudinaryService.verifyUploadResponse("menu", {
        publicId: "chovia/avatars/avatar_123",
        format: "webp",
        bytes: 1024000,
      });
    }).toThrow(BadRequestError);

    // Mismatched format (e.g. executable or disallowed PDF for menu)
    expect(() => {
      cloudinaryService.verifyUploadResponse("menu", {
        publicId: "chovia/menu/item_123",
        format: "pdf",
        bytes: 1024000,
      });
    }).toThrow(BadRequestError);

    // Size exceeding category limit
    expect(() => {
      cloudinaryService.verifyUploadResponse("menu", {
        publicId: "chovia/menu/item_123",
        format: "webp",
        bytes: 6 * 1024 * 1024, // 6MB exceeds 5MB limit
      });
    }).toThrow(BadRequestError);
  });
});

describe("Opaque BullMQ Job IDs & PII Protection", () => {
  it("should create opaque job IDs using SHA-256 digests without leaking plain PII", () => {
    const rawEmail = "sensitive.user@chovia.app";
    const rawOtp = "998877";
    const rawToken = "super_secret_staff_token_xyz";

    const verifyJobId = createOpaqueJobId("email_verify", rawEmail, 1700000000);
    const resetJobId = createOpaqueJobId("email_reset", rawEmail, rawOtp);
    const inviteJobId = createOpaqueJobId("email_invite", rawEmail, rawToken);

    // Assert format prefix_digest
    expect(verifyJobId).toMatch(/^email_verify_[a-f0-9]{24}$/);
    expect(resetJobId).toMatch(/^email_reset_[a-f0-9]{24}$/);
    expect(inviteJobId).toMatch(/^email_invite_[a-f0-9]{24}$/);

    // Assert NO plain PII is present in the opaque ID
    expect(verifyJobId).not.toContain(rawEmail);
    expect(resetJobId).not.toContain(rawOtp);
    expect(resetJobId).not.toContain(rawEmail);
    expect(inviteJobId).not.toContain(rawToken);
    expect(inviteJobId).not.toContain(rawEmail);
  });
});

describe("Transactional Outbox Dispatcher (Atomic Claim, Dispatch, Retry)", () => {
  it("should skip event when concurrent worker already claimed it (atomic claim count = 0)", async () => {
    const pendingEvents = [
      {
        id: "evt_concurrent",
        eventType: "ORDER_CONFIRMED_NOTIFICATION",
        payload: { userId: "usr_1" },
        attempts: 0,
        status: "PENDING",
      },
    ];

    const findManySpy = vi.spyOn(prisma.outboxEvent, "findMany").mockResolvedValueOnce(pendingEvents as any);
    const updateManySpy = vi.spyOn(prisma.outboxEvent, "updateMany").mockResolvedValueOnce({ count: 0 }); // Claim failed
    const updateSpy = vi.spyOn(prisma.outboxEvent, "update");

    try {
      const dispatched = await outboxDispatcher.dispatchPendingEvents();
      expect(dispatched).toBe(0);
      expect(updateSpy).not.toHaveBeenCalled();
    } finally {
      findManySpy.mockRestore();
      updateManySpy.mockRestore();
      updateSpy.mockRestore();
    }
  });

  it("should process and mark event DISPATCHED upon successful BullMQ queueing", async () => {
    const pendingEvents = [
      {
        id: "evt_1",
        eventType: "ORDER_CONFIRMED_NOTIFICATION",
        payload: { userId: "usr_1", title: "Confirmed", body: "Food on way" },
        attempts: 0,
        status: "PENDING",
      },
    ];

    const findManySpy = vi.spyOn(prisma.outboxEvent, "findMany").mockResolvedValueOnce(pendingEvents as any);
    const updateManySpy = vi.spyOn(prisma.outboxEvent, "updateMany").mockResolvedValueOnce({ count: 1 });
    const updateSpy = vi.spyOn(prisma.outboxEvent, "update").mockResolvedValueOnce({} as any);

    const queueMod = await import("../jobs/queues/index.js");
    const enqueueSpy = vi.spyOn(queueMod, "enqueuePushNotification").mockResolvedValueOnce();

    try {
      const dispatched = await outboxDispatcher.dispatchPendingEvents();
      expect(dispatched).toBe(1);
      expect(enqueueSpy).toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "evt_1" },
          data: expect.objectContaining({ status: "DISPATCHED" }),
        })
      );
    } finally {
      findManySpy.mockRestore();
      updateManySpy.mockRestore();
      updateSpy.mockRestore();
      enqueueSpy.mockRestore();
    }
  });

  it("should schedule exponential backoff retry when dispatch encounters an error", async () => {
    const pendingEvents = [
      {
        id: "evt_fail",
        eventType: "ORDER_CONFIRMED_NOTIFICATION",
        payload: { userId: "usr_fail" },
        attempts: 1,
        status: "PENDING",
      },
    ];

    const findManySpy = vi.spyOn(prisma.outboxEvent, "findMany").mockResolvedValueOnce(pendingEvents as any);
    const updateManySpy = vi.spyOn(prisma.outboxEvent, "updateMany").mockResolvedValueOnce({ count: 1 });
    const updateSpy = vi.spyOn(prisma.outboxEvent, "update").mockResolvedValueOnce({} as any);

    const queueMod = await import("../jobs/queues/index.js");
    const enqueueSpy = vi.spyOn(queueMod, "enqueuePushNotification").mockRejectedValueOnce(new Error("Redis connection refused"));

    try {
      const dispatched = await outboxDispatcher.dispatchPendingEvents();
      expect(dispatched).toBe(0);
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "evt_fail" },
          data: expect.objectContaining({
            status: "PENDING",
            lastError: "Redis connection refused",
          }),
        })
      );
    } finally {
      findManySpy.mockRestore();
      updateManySpy.mockRestore();
      updateSpy.mockRestore();
      enqueueSpy.mockRestore();
    }
  });
});

describe("Delivery Dispatch Processor & Rider Lifecycle Constraints", () => {
  it("should refuse to dispatch rider if order is not in READY status (e.g. PREPARING)", async () => {
    const delivery = {
      id: "del_preparing",
      orderId: "ord_preparing",
      status: "READY",
      riderId: null,
      order: {
        id: "ord_preparing",
        status: "PREPARING", // Invariant violation: kitchen is still cooking!
        restaurant: { latitude: 6.5244, longitude: 3.3792 },
        customer: { userId: "cust_1" },
      },
    };

    const findDeliverySpy = vi.spyOn(prisma.delivery, "findUnique").mockResolvedValueOnce(delivery as any);
    const findRidersSpy = vi.spyOn(prisma.riderProfile, "findMany");
    const txSpy = vi.spyOn(prisma, "$transaction");

    try {
      const mockJob = {
        name: JOB_NAMES.CHECK_DELIVERY_TIMEOUT,
        data: { deliveryId: "del_preparing", orderId: "ord_preparing" },
      } as Job;

      await processDeliveryJob(mockJob);
      expect(findRidersSpy).not.toHaveBeenCalled();
      expect(txSpy).not.toHaveBeenCalled();
    } finally {
      findDeliverySpy.mockRestore();
      findRidersSpy.mockRestore();
      txSpy.mockRestore();
    }
  });

  it("should match only active, online, available riders within 10km with fresh locations", async () => {
    const delivery = {
      id: "del_ready",
      orderId: "ord_ready",
      status: "READY",
      riderId: null,
      order: {
        id: "ord_ready",
        status: "READY",
        orderNumber: "CHV-ORD-333",
        restaurant: { name: "Mama Put", latitude: 6.5244, longitude: 3.3792 },
        customer: { userId: "cust_3" },
      },
    };

    const freshTime = new Date();
    const staleTime = new Date(Date.now() - 45 * 60 * 1000); // 45m ago (> 30m cutoff)

    const riders = [
      {
        id: "rider_stale",
        userId: "usr_r1",
        firstName: "Stale",
        lastName: "Rider",
        lastLatitude: 6.525,
        lastLongitude: 3.38,
        lastLocationUpdatedAt: staleTime,
      },
      {
        id: "rider_too_far",
        userId: "usr_r2",
        firstName: "Far",
        lastName: "Rider",
        lastLatitude: 6.9, // > 40km away
        lastLongitude: 3.8,
        lastLocationUpdatedAt: freshTime,
      },
      {
        id: "rider_eligible",
        userId: "usr_r3",
        firstName: "Eligible",
        lastName: "Rider",
        lastLatitude: 6.53, // ~1km away
        lastLongitude: 3.38,
        lastLocationUpdatedAt: freshTime,
      },
    ];

    const findDeliverySpy = vi.spyOn(prisma.delivery, "findUnique").mockResolvedValueOnce(delivery as any);
    const findRidersSpy = vi.spyOn(prisma.riderProfile, "findMany").mockResolvedValueOnce(riders as any);

    const txDeliveryUpdateManySpy = vi.fn().mockResolvedValue({ count: 1 });
    const txAssignmentEventSpy = vi.fn().mockResolvedValue({});
    const txOrderHistorySpy = vi.fn().mockResolvedValue({});
    const txOrderUpdateSpy = vi.fn().mockResolvedValue({});
    const txNotificationSpy = vi.fn().mockResolvedValue({});

    const mockTx = {
      delivery: { updateMany: txDeliveryUpdateManySpy },
      deliveryAssignmentEvent: { create: txAssignmentEventSpy },
      orderStatusHistory: { create: txOrderHistorySpy },
      order: { update: txOrderUpdateSpy },
      notification: { create: txNotificationSpy },
    };

    const txSpy = vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (cb: any) => {
      return cb(mockTx);
    });

    try {
      const mockJob = {
        name: JOB_NAMES.CHECK_DELIVERY_TIMEOUT,
        data: { deliveryId: "del_ready", orderId: "ord_ready" },
      } as Job;

      await processDeliveryJob(mockJob);

      // Verify assignment was made to the eligible rider (rider_eligible)
      expect(txDeliveryUpdateManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            riderId: "rider_eligible",
            status: "ASSIGNED",
          }),
        })
      );
    } finally {
      findDeliverySpy.mockRestore();
      findRidersSpy.mockRestore();
      txSpy.mockRestore();
    }
  });

  it("should enforce bounded retries and write audit log alert when max dispatch attempts are reached", async () => {
    const delivery = {
      id: "del_no_rider",
      orderId: "ord_no_rider",
      status: "READY",
      riderId: null,
      dispatchAttempts: 2, // 3rd attempt will hit max
      order: {
        id: "ord_no_rider",
        status: "READY",
        orderNumber: "CHV-ORD-444",
        restaurant: { name: "Burger Joint", latitude: 6.5244, longitude: 3.3792 },
        customer: { userId: "cust_4" },
      },
    };

    const findDeliverySpy = vi.spyOn(prisma.delivery, "findUnique").mockResolvedValueOnce(delivery as any);
    const findRidersSpy = vi.spyOn(prisma.riderProfile, "findMany").mockResolvedValueOnce([]); // No riders online
    const deliveryUpdateSpy = vi.spyOn(prisma.delivery, "update").mockResolvedValueOnce({} as any);
    const auditLogCreateSpy = vi.spyOn(prisma.auditLog, "create").mockResolvedValueOnce({} as any);

    try {
      const mockJob = {
        name: JOB_NAMES.CHECK_DELIVERY_TIMEOUT,
        data: { deliveryId: "del_no_rider", orderId: "ord_no_rider" },
      } as Job;

      await processDeliveryJob(mockJob);

      // Attempts incremented to 3
      expect(deliveryUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dispatchAttempts: 3,
          }),
        })
      );

      // Audit alert emitted for ops manual escalation
      expect(auditLogCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: "Delivery",
            entityId: "del_no_rider",
            metadata: expect.objectContaining({
              alert: "DISPATCH_RETRY_EXHAUSTED",
            }),
          }),
        })
      );
    } finally {
      findDeliverySpy.mockRestore();
      findRidersSpy.mockRestore();
      deliveryUpdateSpy.mockRestore();
      auditLogCreateSpy.mockRestore();
    }
  });
});

describe("Expo Push Service & Token Maintenance", () => {
  it("should validate Expo push token format correctly", () => {
    expect(isExpoPushToken("ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]")).toBe(true);
    expect(isExpoPushToken("ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]")).toBe(true);
    expect(isExpoPushToken("12345678-1234-1234-1234-123456789abc")).toBe(true);
    expect(isExpoPushToken("invalid-token-format")).toBe(false);
    expect(isExpoPushToken("")).toBe(false);
  });

  it("should return mock tickets in test/development environment", async () => {
    const messages = [
      {
        to: "ExponentPushToken[mock_token_1]",
        title: "Test Push",
        body: "Testing message",
      },
    ];

    const tickets = await expoPushService.sendPushNotifications(messages);
    expect(tickets.length).toBe(1);
    expect(tickets[0].status).toBe("ok");
    expect(tickets[0].id).toBeDefined();
  });

  it("should deactivate unregistered device tokens when DeviceNotRegistered is reported", async () => {
    const userDeviceUpdateSpy = vi.spyOn(prisma.userDevice, "updateMany").mockResolvedValueOnce({ count: 1 });

    try {
      await expoPushService.deactivateInvalidToken("ExponentPushToken[dead_token_123]");
      expect(userDeviceUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { expoPushToken: "ExponentPushToken[dead_token_123]" },
          data: { isActive: false },
        })
      );
    } finally {
      userDeviceUpdateSpy.mockRestore();
    }
  });
});
