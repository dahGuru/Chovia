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

  it("should prevent delimiter injection collisions using length-prefixed canonical encoding", () => {
    // Delimiter injection: ["a:b", "c"] vs ["a", "b:c"]
    const id1 = createOpaqueJobId("test", "a:b", "c");
    const id2 = createOpaqueJobId("test", "a", "b:c");
    expect(id1).not.toBe(id2);

    // Stable deterministic ID across runs without timestamps
    const stable1 = createOpaqueJobId("email_verify", "user@chovia.app", "123456");
    const stable2 = createOpaqueJobId("email_verify", "user@chovia.app", "123456");
    expect(stable1).toBe(stable2);
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
    const updateManySpy = vi.spyOn(prisma.outboxEvent, "updateMany").mockResolvedValue({ count: 1 });

    const queueMod = await import("../jobs/queues/index.js");
    const enqueueSpy = vi.spyOn(queueMod, "enqueuePushNotification").mockResolvedValueOnce();

    try {
      const dispatched = await outboxDispatcher.dispatchPendingEvents();
      expect(dispatched).toBe(1);
      expect(enqueueSpy).toHaveBeenCalled();
      expect(updateManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: "evt_1", status: "PROCESSING" }),
          data: expect.objectContaining({ status: "DISPATCHED" }),
        })
      );
    } finally {
      findManySpy.mockRestore();
      updateManySpy.mockRestore();
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
    const updateManySpy = vi.spyOn(prisma.outboxEvent, "updateMany").mockResolvedValue({ count: 1 });

    const queueMod = await import("../jobs/queues/index.js");
    const enqueueSpy = vi.spyOn(queueMod, "enqueuePushNotification").mockRejectedValueOnce(new Error("Redis connection refused"));

    try {
      const dispatched = await outboxDispatcher.dispatchPendingEvents();
      expect(dispatched).toBe(0);
      expect(updateManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: "evt_fail", status: "PROCESSING" }),
          data: expect.objectContaining({
            status: "PENDING",
            lastError: "Redis connection refused",
          }),
        })
      );
    } finally {
      findManySpy.mockRestore();
      updateManySpy.mockRestore();
      enqueueSpy.mockRestore();
    }
  });

  it("should generate claimToken and leaseExpiresAt during atomic claim", async () => {
    const pendingEvents = [
      {
        id: "evt_lease_test",
        eventType: "ORDER_CONFIRMED_NOTIFICATION",
        payload: { userId: "usr_lease", title: "Lease", body: "Checking claimToken" },
        attempts: 0,
        status: "PENDING",
      },
    ];

    const findManySpy = vi.spyOn(prisma.outboxEvent, "findMany").mockResolvedValueOnce(pendingEvents as any);
    const updateManySpy = vi.spyOn(prisma.outboxEvent, "updateMany").mockResolvedValue({ count: 1 });

    const queueMod = await import("../jobs/queues/index.js");
    const enqueueSpy = vi.spyOn(queueMod, "enqueuePushNotification").mockResolvedValueOnce();

    try {
      await outboxDispatcher.dispatchPendingEvents();
      expect(updateManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "evt_lease_test", status: "PENDING" },
          data: expect.objectContaining({
            status: "PROCESSING",
            attempts: { increment: 1 },
            claimToken: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
            leaseExpiresAt: expect.any(Date),
          }),
        })
      );
    } finally {
      findManySpy.mockRestore();
      updateManySpy.mockRestore();
      enqueueSpy.mockRestore();
    }
  });

  it("should abort completion if lease expired and claimToken was lost (markResult count = 0)", async () => {
    const pendingEvents = [
      {
        id: "evt_lost_lease",
        eventType: "ORDER_CONFIRMED_NOTIFICATION",
        payload: { userId: "usr_lost", title: "Lost", body: "Lease lost" },
        attempts: 0,
        status: "PENDING",
      },
    ];

    const findManySpy = vi.spyOn(prisma.outboxEvent, "findMany").mockResolvedValueOnce(pendingEvents as any);
    const updateManySpy = vi.spyOn(prisma.outboxEvent, "updateMany")
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const queueMod = await import("../jobs/queues/index.js");
    const enqueueSpy = vi.spyOn(queueMod, "enqueuePushNotification").mockResolvedValueOnce();

    try {
      const dispatched = await outboxDispatcher.dispatchPendingEvents();
      expect(dispatched).toBe(0);
    } finally {
      findManySpy.mockRestore();
      updateManySpy.mockRestore();
      enqueueSpy.mockRestore();
    }
  });

  it("should recover stale PROCESSING events whose lease has expired", async () => {
    const staleEvents = [
      {
        id: "evt_stale_1",
        status: "PROCESSING",
        attempts: 2,
        updatedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago (> 5 min lease)
      },
      {
        id: "evt_stale_max_attempts",
        status: "PROCESSING",
        attempts: 5, // Reached max attempts
        updatedAt: new Date(Date.now() - 10 * 60 * 1000),
      },
    ];

    const findManySpy = vi.spyOn(prisma.outboxEvent, "findMany").mockResolvedValueOnce(staleEvents as any);
    const updateManySpy = vi.spyOn(prisma.outboxEvent, "updateMany")
      .mockResolvedValueOnce({ count: 1 }) // evt_stale_1 recovered to PENDING
      .mockResolvedValueOnce({ count: 1 }); // evt_stale_max_attempts recovered to FAILED

    try {
      const recovered = await outboxDispatcher.recoverStaleProcessingEvents();
      expect(recovered).toBe(2);
      expect(updateManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: "evt_stale_1", status: "PROCESSING" }),
          data: expect.objectContaining({ status: "PENDING" }),
        })
      );
      expect(updateManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: "evt_stale_max_attempts", status: "PROCESSING" }),
          data: expect.objectContaining({ status: "FAILED" }),
        })
      );
    } finally {
      findManySpy.mockRestore();
      updateManySpy.mockRestore();
    }
  });

  it("should start and stop the recurring outbox dispatcher loop gracefully", async () => {
    const recoverSpy = vi.spyOn(outboxDispatcher, "recoverStaleProcessingEvents").mockResolvedValue(0);
    const dispatchSpy = vi.spyOn(outboxDispatcher, "dispatchPendingEvents").mockResolvedValue(0);

    outboxDispatcher.start(50); // Fast interval for testing
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(recoverSpy).toHaveBeenCalled();
    expect(dispatchSpy).toHaveBeenCalled();

    await outboxDispatcher.stop();
    recoverSpy.mockRestore();
    dispatchSpy.mockRestore();
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
        status: "ACTIVE",
        isOnline: true,
        isAvailable: true,
        lastLatitude: 6.525,
        lastLongitude: 3.38,
        lastLocationUpdatedAt: staleTime,
      },
      {
        id: "rider_too_far",
        userId: "usr_r2",
        firstName: "Far",
        lastName: "Rider",
        status: "ACTIVE",
        isOnline: true,
        isAvailable: true,
        lastLatitude: 6.9, // > 40km away
        lastLongitude: 3.8,
        lastLocationUpdatedAt: freshTime,
      },
      {
        id: "rider_eligible",
        userId: "usr_r3",
        firstName: "Eligible",
        lastName: "Rider",
        status: "ACTIVE",
        isOnline: true,
        isAvailable: true,
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
      riderProfile: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), update: vi.fn() },
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

  it("should create durable Outbox event as single authoritative retry path without direct BullMQ duplicate when no riders found", async () => {
    const delivery = {
      id: "del_single_retry",
      orderId: "ord_single_retry",
      status: "READY",
      riderId: null,
      dispatchAttempts: 0,
      order: {
        id: "ord_single_retry",
        status: "READY",
        orderNumber: "CHV-ORD-555",
        restaurant: { name: "Burger Spot", latitude: 6.5244, longitude: 3.3792 },
        customer: { userId: "cust_5" },
      },
    };

    const findDeliverySpy = vi.spyOn(prisma.delivery, "findUnique").mockResolvedValueOnce(delivery as any);
    const findRidersSpy = vi.spyOn(prisma.riderProfile, "findMany").mockResolvedValueOnce([]); // No riders online
    const deliveryUpdateSpy = vi.spyOn(prisma.delivery, "update").mockResolvedValueOnce({} as any);
    const outboxCreateSpy = vi.spyOn(prisma.outboxEvent, "create").mockResolvedValueOnce({} as any);
    const findNotifSpy = vi.spyOn(prisma.notification, "findFirst").mockResolvedValueOnce(null);
    const createNotifSpy = vi.spyOn(prisma.notification, "create").mockResolvedValueOnce({} as any);

    const queueMod = await import("../jobs/queues/index.js");
    const enqueueTimeoutSpy = vi.spyOn(queueMod, "enqueueDeliveryTimeoutCheck");

    try {
      const mockJob = {
        name: JOB_NAMES.CHECK_DELIVERY_TIMEOUT,
        data: { deliveryId: "del_single_retry", orderId: "ord_single_retry" },
      } as Job;

      await processDeliveryJob(mockJob);

      // Verify delivery dispatchAttempts was updated
      expect(deliveryUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ dispatchAttempts: 1 }),
        })
      );

      // Verify Outbox event was created as single authoritative retry
      expect(outboxCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: "DISPATCH_DELIVERY",
            aggregateType: "DELIVERY",
            aggregateId: "del_single_retry",
            status: "PENDING",
          }),
        })
      );

      // Verify NO duplicate direct BullMQ enqueue happened
      expect(enqueueTimeoutSpy).not.toHaveBeenCalled();
    } finally {
      findDeliverySpy.mockRestore();
      findRidersSpy.mockRestore();
      deliveryUpdateSpy.mockRestore();
      outboxCreateSpy.mockRestore();
      findNotifSpy.mockRestore();
      createNotifSpy.mockRestore();
      enqueueTimeoutSpy.mockRestore();
    }
  });

  it("should reject riders with missing coordinates, out-of-range coordinates, or future-dated timestamps", async () => {
    const delivery = {
      id: "del_strict_geo",
      orderId: "ord_strict_geo",
      status: "READY",
      riderId: null,
      dispatchAttempts: 0,
      order: {
        id: "ord_strict_geo",
        status: "READY",
        orderNumber: "CHV-ORD-777",
        restaurant: { name: "Tasty Bites", latitude: 6.5244, longitude: 3.3792 },
        customer: { userId: "cust_7" },
      },
    };

    const invalidRiders = [
      {
        id: "rider_no_coords",
        userId: "usr_no_coords",
        firstName: "No",
        lastName: "Coords",
        lastLatitude: null, // Missing coordinates
        lastLongitude: null,
        lastLocationUpdatedAt: new Date(),
      },
      {
        id: "rider_out_of_range",
        userId: "usr_out_of_range",
        firstName: "Invalid",
        lastName: "Range",
        lastLatitude: 95.0, // Invalid latitude (> 90)
        lastLongitude: 3.38,
        lastLocationUpdatedAt: new Date(),
      },
      {
        id: "rider_future_dated",
        userId: "usr_future_dated",
        firstName: "Future",
        lastName: "Dated",
        lastLatitude: 6.525,
        lastLongitude: 3.38,
        lastLocationUpdatedAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes in future
      },
    ];

    const findDeliverySpy = vi.spyOn(prisma.delivery, "findUnique").mockResolvedValueOnce(delivery as any);
    const findRidersSpy = vi.spyOn(prisma.riderProfile, "findMany").mockResolvedValueOnce(invalidRiders as any);
    const deliveryUpdateSpy = vi.spyOn(prisma.delivery, "update").mockResolvedValueOnce({} as any);
    const notificationFindSpy = vi.spyOn(prisma.notification, "findFirst").mockResolvedValueOnce(null);
    const notificationCreateSpy = vi.spyOn(prisma.notification, "create").mockResolvedValueOnce({} as any);
    const outboxCreateSpy = vi.spyOn(prisma.outboxEvent, "create").mockResolvedValueOnce({} as any);

    try {
      const mockJob = {
        name: JOB_NAMES.CHECK_DELIVERY_TIMEOUT,
        data: { deliveryId: "del_strict_geo", orderId: "ord_strict_geo" },
      } as Job;

      await processDeliveryJob(mockJob);

      // No rider assigned, dispatch attempts incremented
      expect(deliveryUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ dispatchAttempts: 1 }),
        })
      );
    } finally {
      findDeliverySpy.mockRestore();
      findRidersSpy.mockRestore();
      deliveryUpdateSpy.mockRestore();
      notificationFindSpy.mockRestore();
      notificationCreateSpy.mockRestore();
      outboxCreateSpy.mockRestore();
    }
  });

  it("should advance to next candidate when first rider atomic claim fails due to concurrency", async () => {
    const delivery = {
      id: "del_race",
      orderId: "ord_race",
      status: "READY",
      riderId: null,
      dispatchAttempts: 0,
      order: {
        id: "ord_race",
        status: "READY",
        orderNumber: "CHV-ORD-888",
        restaurant: { name: "Tasty Bites", latitude: 6.5244, longitude: 3.3792 },
        customer: { userId: "cust_8" },
      },
    };

    const eligibleRiders = [
      {
        id: "rider_taken_concurrently",
        userId: "usr_taken",
        firstName: "First",
        lastName: "Candidate",
        status: "ACTIVE",
        isOnline: true,
        isAvailable: true,
        lastLatitude: 6.525,
        lastLongitude: 3.38,
        lastLocationUpdatedAt: new Date(),
      },
      {
        id: "rider_second_available",
        userId: "usr_available",
        firstName: "Second",
        lastName: "Candidate",
        status: "ACTIVE",
        isOnline: true,
        isAvailable: true,
        lastLatitude: 6.526,
        lastLongitude: 3.381,
        lastLocationUpdatedAt: new Date(),
      },
    ];

    const findDeliverySpy = vi.spyOn(prisma.delivery, "findUnique").mockResolvedValueOnce(delivery as any);
    const findRidersSpy = vi.spyOn(prisma.riderProfile, "findMany").mockResolvedValueOnce(eligibleRiders as any);

    const txDeliveryUpdateManySpy = vi.fn().mockResolvedValue({ count: 1 });

    // Mock transaction: first rider claim returns count = 0 (taken), second rider claim returns count = 1 (won)
    const txSpy = vi.spyOn(prisma, "$transaction")
      .mockImplementationOnce(async (cb: any) => {
        return cb({
          riderProfile: {
            updateMany: vi.fn().mockResolvedValue({ count: 0 }), // Lost race for first rider
          },
        });
      })
      .mockImplementationOnce(async (cb: any) => {
        return cb({
          riderProfile: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }), // Won race for second rider
          },
          delivery: { updateMany: txDeliveryUpdateManySpy },
          deliveryAssignmentEvent: { create: vi.fn().mockResolvedValue({}) },
          orderStatusHistory: { create: vi.fn().mockResolvedValue({}) },
          order: { update: vi.fn().mockResolvedValue({}) },
          notification: { create: vi.fn().mockResolvedValue({}) },
        });
      });

    try {
      const mockJob = {
        name: JOB_NAMES.CHECK_DELIVERY_TIMEOUT,
        data: { deliveryId: "del_race", orderId: "ord_race" },
      } as Job;

      await processDeliveryJob(mockJob);

      // Verify delivery assigned to second candidate
      expect(txDeliveryUpdateManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            riderId: "rider_second_available",
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

  it("should restore rider availability when delivery is completed", async () => {
    const { deliveryService } = await import("../modules/delivery/delivery.service.js");

    const mockRider = {
      id: "rider_comp_1",
      userId: "usr_rider_comp",
      isAvailable: false,
    };

    const mockDelivery = {
      id: "del_comp_1",
      orderId: "ord_comp_1",
      riderId: "rider_comp_1",
      status: "OUT_FOR_DELIVERY",
      order: { restaurantId: "rest_1" },
    };

    const findRiderSpy = vi.spyOn(prisma.riderProfile, "findUnique").mockResolvedValueOnce(mockRider as any);
    const findDeliverySpy = vi.spyOn(prisma.delivery, "findUnique").mockResolvedValueOnce(mockDelivery as any);

    const txRiderProfileUpdateSpy = vi.fn().mockResolvedValue({});
    const txDeliveryCountSpy = vi.fn().mockResolvedValue(0);
    const mockTx = {
      delivery: {
        update: vi.fn().mockResolvedValue({
          id: "del_comp_1",
          orderId: "ord_comp_1",
          status: "DELIVERED",
          deliveredAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          order: { id: "ord_comp_1", restaurant: {} },
        }),
        count: txDeliveryCountSpy,
      },
      orderStatusHistory: { create: vi.fn().mockResolvedValue({}) },
      order: { update: vi.fn().mockResolvedValue({}) },
      riderProfile: { update: txRiderProfileUpdateSpy },
    };

    const txSpy = vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (cb: any) => {
      return cb(mockTx);
    });

    try {
      const result = await deliveryService.completeDelivery("usr_rider_comp", "del_comp_1");
      expect(result.status).toBe("DELIVERED");
      expect(txRiderProfileUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "rider_comp_1" },
          data: { isAvailable: true },
        })
      );
    } finally {
      findRiderSpy.mockRestore();
      findDeliverySpy.mockRestore();
      txSpy.mockRestore();
    }
  });

  it("should enforce shared rider eligibility validation rules", async () => {
    const { validateRiderEligibility } = await import("../modules/delivery/delivery-eligibility.js");

    const validRider = {
      status: "ACTIVE",
      isOnline: true,
      isAvailable: true,
      lastLatitude: 6.5244,
      lastLongitude: 3.3792,
      lastLocationUpdatedAt: new Date(),
      activeDeliveryCount: 0,
    };

    expect(validateRiderEligibility(validRider).eligible).toBe(true);

    // Inactive status
    expect(validateRiderEligibility({ ...validRider, status: "PENDING_APPROVAL" }).eligible).toBe(false);

    // Offline
    expect(validateRiderEligibility({ ...validRider, isOnline: false }).eligible).toBe(false);

    // Unavailable
    expect(validateRiderEligibility({ ...validRider, isAvailable: false }).eligible).toBe(false);

    // Has active deliveries
    expect(validateRiderEligibility({ ...validRider, activeDeliveryCount: 1 }).eligible).toBe(false);

    // Missing coordinates
    expect(validateRiderEligibility({ ...validRider, lastLatitude: null }).eligible).toBe(false);

    // Out of bounds coordinates
    expect(validateRiderEligibility({ ...validRider, lastLatitude: 95.0 }).eligible).toBe(false);

    // Missing location timestamp
    expect(validateRiderEligibility({ ...validRider, lastLocationUpdatedAt: null }).eligible).toBe(false);

    // Future-dated timestamp (> 60s)
    expect(validateRiderEligibility({ ...validRider, lastLocationUpdatedAt: new Date(Date.now() + 120000) }).eligible).toBe(false);

    // Stale timestamp (> 30m)
    expect(validateRiderEligibility({ ...validRider, lastLocationUpdatedAt: new Date(Date.now() - 35 * 60 * 1000) }).eligible).toBe(false);
  });

  it("should refuse to restore rider availability if rider still has remaining active deliveries", async () => {
    const { deliveryService } = await import("../modules/delivery/delivery.service.js");

    const mockRider = {
      id: "rider_multi_1",
      userId: "usr_rider_multi",
      isAvailable: false,
    };

    const mockDelivery = {
      id: "del_comp_first",
      orderId: "ord_comp_first",
      riderId: "rider_multi_1",
      status: "OUT_FOR_DELIVERY",
      order: { restaurantId: "rest_1" },
    };

    const findRiderSpy = vi.spyOn(prisma.riderProfile, "findUnique").mockResolvedValueOnce(mockRider as any);
    const findDeliverySpy = vi.spyOn(prisma.delivery, "findUnique").mockResolvedValueOnce(mockDelivery as any);

    const txRiderProfileUpdateSpy = vi.fn().mockResolvedValue({});
    const txDeliveryCountSpy = vi.fn().mockResolvedValue(1); // 1 remaining active delivery!
    const mockTx = {
      delivery: {
        update: vi.fn().mockResolvedValue({
          id: "del_comp_first",
          orderId: "ord_comp_first",
          status: "DELIVERED",
          deliveredAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          order: { id: "ord_comp_first", restaurant: {} },
        }),
        count: txDeliveryCountSpy,
      },
      orderStatusHistory: { create: vi.fn().mockResolvedValue({}) },
      order: { update: vi.fn().mockResolvedValue({}) },
      riderProfile: { update: txRiderProfileUpdateSpy },
    };

    const txSpy = vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (cb: any) => {
      return cb(mockTx);
    });

    try {
      const result = await deliveryService.completeDelivery("usr_rider_multi", "del_comp_first");
      expect(result.status).toBe("DELIVERED");
      expect(txRiderProfileUpdateSpy).not.toHaveBeenCalled();
    } finally {
      findRiderSpy.mockRestore();
      findDeliverySpy.mockRestore();
      txSpy.mockRestore();
    }
  });

  it("should reject manual acceptDelivery if rider is ineligible or has active deliveries", async () => {
    const { deliveryService } = await import("../modules/delivery/delivery.service.js");

    const mockRiderOffline = {
      id: "rider_off",
      userId: "usr_off",
      status: "ACTIVE",
      isOnline: false, // Ineligible!
      isAvailable: true,
      lastLatitude: 6.5244,
      lastLongitude: 3.3792,
      lastLocationUpdatedAt: new Date(),
      deliveries: [],
    };

    const findRiderSpy = vi.spyOn(prisma.riderProfile, "findUnique").mockResolvedValueOnce(mockRiderOffline as any);

    try {
      await expect(
        deliveryService.acceptDelivery("usr_off", "del_any")
      ).rejects.toThrow(/Rider is not eligible to accept delivery/i);
    } finally {
      findRiderSpy.mockRestore();
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

  it("should fetch push notification receipts and deactivate invalid tokens", async () => {
    const receipts = await expoPushService.getPushNotificationReceipts(["rcpt_1", "rcpt_2"]);
    expect(receipts["rcpt_1"]).toBeDefined();
    expect(receipts["rcpt_1"].status).toBe("ok");

    const userDeviceUpdateSpy = vi.spyOn(prisma.userDevice, "updateMany").mockResolvedValue({ count: 1 });
    const getReceiptsSpy = vi.spyOn(expoPushService, "getPushNotificationReceipts").mockResolvedValueOnce({
      rcpt_dead: {
        status: "error",
        details: { error: "DeviceNotRegistered" },
      },
      rcpt_active: {
        status: "ok",
      },
    });

    try {
      const summary = await expoPushService.processReceiptsAndDeactivateInvalid([
        { receiptId: "rcpt_dead", expoPushToken: "ExponentPushToken[unregistered_device]" },
        { receiptId: "rcpt_active", expoPushToken: "ExponentPushToken[valid_device]" },
      ]);

      expect(summary.processed).toBe(2);
      expect(summary.deactivated).toBe(1);
      expect(userDeviceUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { expoPushToken: "ExponentPushToken[unregistered_device]" },
          data: { isActive: false },
        })
      );
    } finally {
      getReceiptsSpy.mockRestore();
      userDeviceUpdateSpy.mockRestore();
    }
  });

  it("should poll and reconcile receipts for submitted notification deliveries older than 15 minutes", async () => {
    const pastDate = new Date(Date.now() - 20 * 60 * 1000); // 20 minutes ago
    const pendingDeliveries = [
      {
        id: "deliv_ok",
        ticketId: "rcpt_success_123",
        pushToken: "ExponentPushToken[user_ok]",
        status: "SUBMITTED",
        createdAt: pastDate,
      },
      {
        id: "deliv_dead",
        ticketId: "rcpt_dead_456",
        pushToken: "ExponentPushToken[user_dead]",
        status: "SUBMITTED",
        createdAt: pastDate,
      },
    ];

    const findManySpy = vi.spyOn(prisma.notificationDelivery, "findMany").mockResolvedValueOnce(pendingDeliveries as any);
    const updateSpy = vi.spyOn(prisma.notificationDelivery, "update").mockResolvedValue({} as any);
    const userDeviceUpdateSpy = vi.spyOn(prisma.userDevice, "updateMany").mockResolvedValue({ count: 1 });

    const getReceiptsSpy = vi.spyOn(expoPushService, "getPushNotificationReceipts").mockResolvedValueOnce({
      rcpt_success_123: { status: "ok" },
      rcpt_dead_456: {
        status: "error",
        details: { error: "DeviceNotRegistered" },
      },
    });

    try {
      const summary = await expoPushService.pollAndReconcileReceipts(15 * 60 * 1000);
      expect(summary.reconciled).toBe(1);
      expect(summary.failed).toBe(1);

      // Verify success delivery was marked DELIVERED
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "deliv_ok" },
          data: expect.objectContaining({ status: "DELIVERED", receiptId: "rcpt_success_123" }),
        })
      );

      // Verify failed delivery was marked FAILED
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "deliv_dead" },
          data: expect.objectContaining({ status: "FAILED", receiptId: "rcpt_dead_456" }),
        })
      );

      // Verify unregistered device was deactivated
      expect(userDeviceUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { expoPushToken: "ExponentPushToken[user_dead]" },
          data: { isActive: false },
        })
      );
    } finally {
      findManySpy.mockRestore();
      updateSpy.mockRestore();
      userDeviceUpdateSpy.mockRestore();
      getReceiptsSpy.mockRestore();
    }
  });

  it("should start and stop the recurring receipt poller loop gracefully", async () => {
    const pollSpy = vi.spyOn(expoPushService, "pollAndReconcileReceipts").mockResolvedValue({ reconciled: 0, failed: 0 });

    expoPushService.startReceiptPoller(50);
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(pollSpy).toHaveBeenCalled();
    await expoPushService.stopReceiptPoller();
    pollSpy.mockRestore();
  });
});
