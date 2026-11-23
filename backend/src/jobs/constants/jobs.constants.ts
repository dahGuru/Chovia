export const QUEUE_NAMES = {
  EMAIL: "email-notifications",
  NOTIFICATIONS: "push-notifications",
  DELIVERY: "delivery-dispatch",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const JOB_NAMES = {
  SEND_VERIFICATION_EMAIL: "send-verification-email",
  SEND_PASSWORD_RESET_EMAIL: "send-password-reset-email",
  SEND_STAFF_INVITE_EMAIL: "send-staff-invite-email",
  SEND_PUSH_NOTIFICATION: "send-push-notification",
  CHECK_DELIVERY_TIMEOUT: "check-delivery-timeout",
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];
