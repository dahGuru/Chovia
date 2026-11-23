import type { Job } from "bullmq";
import { JOB_NAMES } from "../constants/jobs.constants.js";
import { resendService } from "../../integrations/resend/resend.service.js";
import type {
  SendVerificationEmailJobData,
  SendPasswordResetEmailJobData,
  SendStaffInviteEmailJobData,
} from "../types/jobs.types.js";

export async function processEmailJob(job: Job): Promise<void> {
  switch (job.name) {
    case JOB_NAMES.SEND_VERIFICATION_EMAIL: {
      const data = job.data as SendVerificationEmailJobData;
      await resendService.sendVerificationOtp(data.email, data.otp);
      break;
    }
    case JOB_NAMES.SEND_PASSWORD_RESET_EMAIL: {
      const data = job.data as SendPasswordResetEmailJobData;
      await resendService.sendPasswordResetOtp(data.email, data.otp);
      break;
    }
    case JOB_NAMES.SEND_STAFF_INVITE_EMAIL: {
      const data = job.data as SendStaffInviteEmailJobData;
      await resendService.sendStaffInvitation(
        data.email,
        data.restaurantName,
        data.role,
        data.inviteToken
      );
      break;
    }
    default:
      throw new Error(`Unknown email job name: ${job.name}`);
  }
}
