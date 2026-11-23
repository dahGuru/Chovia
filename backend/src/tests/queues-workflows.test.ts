import { describe, it, expect, vi } from "vitest";
import {
  enqueueVerificationEmail,
  enqueuePasswordResetEmail,
  enqueueStaffInviteEmail,
  enqueuePushNotification,
  enqueueDeliveryTimeoutCheck,
} from "../jobs/queues/index.js";
import { emailService } from "../integrations/email/email.service.js";
import { resendService } from "../integrations/resend/resend.service.js";
import { processEmailJob } from "../jobs/processors/email.processor.js";
import { JOB_NAMES } from "../jobs/constants/jobs.constants.js";
import { cloudinaryService, UPLOAD_POLICIES } from "../integrations/cloudinary/cloudinary.service.js";
import { BadRequestError } from "../common/errors/api-error.js";

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
