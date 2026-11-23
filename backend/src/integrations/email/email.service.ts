import { resendService } from "../resend/resend.service.js";
import {
  getEmailQueue,
  enqueueVerificationEmail,
  enqueuePasswordResetEmail,
  enqueueStaffInviteEmail,
} from "../../jobs/queues/index.js";

export class EmailService {
  async sendVerificationEmail(email: string, otp: string): Promise<void> {
    const queue = getEmailQueue();
    if (queue) {
      try {
        await enqueueVerificationEmail({ email, otp });
        return;
      } catch {
        // Fallback to direct sending if queue delivery fails
        await resendService.sendVerificationOtp(email, otp);
        return;
      }
    }
    await resendService.sendVerificationOtp(email, otp);
  }

  async sendPasswordResetEmail(email: string, otp: string): Promise<void> {
    const queue = getEmailQueue();
    if (queue) {
      try {
        await enqueuePasswordResetEmail({ email, otp });
        return;
      } catch {
        // Fallback to direct sending if queue delivery fails
        await resendService.sendPasswordResetOtp(email, otp);
        return;
      }
    }
    await resendService.sendPasswordResetOtp(email, otp);
  }

  async sendStaffInvitationEmail(
    email: string,
    restaurantName: string,
    role: string,
    inviteToken: string
  ): Promise<void> {
    const queue = getEmailQueue();
    if (queue) {
      try {
        await enqueueStaffInviteEmail({ email, restaurantName, role, inviteToken });
        return;
      } catch {
        // Fallback to direct sending if queue delivery fails
        await resendService.sendStaffInvitation(email, restaurantName, role, inviteToken);
        return;
      }
    }
    await resendService.sendStaffInvitation(email, restaurantName, role, inviteToken);
  }
}

export const emailService = new EmailService();
