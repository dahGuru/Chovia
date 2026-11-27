"use client";

import type { PortalAuthUser } from "@chovia/web-ui";
import { api } from "./api";

export interface RegisterRestaurantPartnerRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
}

export interface OtpDataResponse {
  message: string;
  signedToken: string;
  expiresInMinutes: number;
}

export interface RegisterRestaurantPartnerResponse {
  user: PortalAuthUser;
  otpData: OtpDataResponse;
  emailDeliveryStatus: "SENT" | "FAILED_RETRYABLE";
}

export const authService = {
  async registerPartner(
    payload: RegisterRestaurantPartnerRequest
  ): Promise<RegisterRestaurantPartnerResponse> {
    const { data } = await api.post<RegisterRestaurantPartnerResponse>(
      "/auth/restaurant/register",
      payload
    );
    return data;
  },

  async requestEmailVerification(email: string): Promise<OtpDataResponse> {
    const { data } = await api.post<OtpDataResponse>("/auth/verify-email/request", { email });
    return data;
  },

  async verifyEmail(email: string, otp: string, signedToken: string): Promise<{ message: string; success: boolean }> {
    const { data } = await api.post<{ message: string; success: boolean }>(
      "/auth/verify-email/verify",
      { email, otp, signedToken }
    );
    return data;
  },

  async requestPasswordReset(email: string): Promise<OtpDataResponse> {
    const { data } = await api.post<OtpDataResponse>("/auth/password-reset/request", { email });
    return data;
  },

  async verifyPasswordReset(
    email: string,
    otp: string,
    signedToken: string
  ): Promise<{ message: string; resetToken: string; success: boolean }> {
    const { data } = await api.post<{ message: string; resetToken: string; success: boolean }>(
      "/auth/password-reset/verify",
      { email, otp, signedToken }
    );
    return data;
  },

  async completePasswordReset(
    email: string,
    resetToken: string,
    newPassword: string
  ): Promise<{ message: string; success: boolean }> {
    const { data } = await api.post<{ message: string; success: boolean }>(
      "/auth/password-reset/complete",
      { email, resetToken, newPassword }
    );
    return data;
  },

  async getMe(): Promise<PortalAuthUser> {
    const { data } = await api.get<PortalAuthUser>("/auth/me");
    return data;
  },
};
