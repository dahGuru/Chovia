export interface SendVerificationEmailJobData {
  email: string;
  otp: string;
}

export interface SendPasswordResetEmailJobData {
  email: string;
  otp: string;
}

export interface SendStaffInviteEmailJobData {
  email: string;
  restaurantName: string;
  role: string;
  inviteToken: string;
}

export interface SendPushNotificationJobData {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface CheckDeliveryTimeoutJobData {
  deliveryId: string;
  orderId: string;
}
