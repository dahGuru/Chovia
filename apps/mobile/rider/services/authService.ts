import { api } from "./api";

export type UserRole = "CUSTOMER" | "RESTAURANT_STAFF" | "RIDER" | "ADMIN";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "DEACTIVATED";

export interface UserResponseDto {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  createdAt: string;
}

export interface AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  user: UserResponseDto;
}

export interface OtpSentResponseDto {
  message: string;
  signedToken: string;
  expiresInMinutes: number;
}

export interface MessageResponseDto {
  message: string;
  success: boolean;
}

export interface LoginRequestDto {
  email: string;
  password: string;
  deviceInfo?: {
    deviceId?: string;
    deviceName?: string;
    deviceType?: "IOS" | "ANDROID" | "WEB";
    pushToken?: string;
  };
}

export interface RiderRegisterRequestDto {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
}

export interface RiderRegisterResponseDto {
  user: UserResponseDto;
  otpData: OtpSentResponseDto;
  riderProfile: {
    id: string;
    status: "PENDING" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
    isOnline: boolean;
    isAvailable: boolean;
  };
  emailDeliveryStatus: "SENT" | "FAILED_RETRYABLE";
}

export interface VerifyEmailOtpDto {
  email: string;
  otp: string;
  signedToken: string;
}

export interface PasswordResetVerifyDto {
  email: string;
  otp: string;
  signedToken: string;
}

export interface PasswordResetCompleteDto {
  email: string;
  resetToken: string;
  newPassword: string;
}

export const authService = {
  async registerRider(payload: RiderRegisterRequestDto): Promise<RiderRegisterResponseDto> {
    const { data } = await api.post<RiderRegisterResponseDto>("/auth/rider/register", payload);
    return data;
  },

  async login(payload: LoginRequestDto): Promise<AuthResponseDto> {
    const { data } = await api.post<AuthResponseDto>("/auth/login", payload);
    return data;
  },

  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    const { data } = await api.post<AuthResponseDto>("/auth/refresh", { refreshToken });
    return data;
  },

  async logout(refreshToken: string): Promise<MessageResponseDto> {
    const { data } = await api.post<MessageResponseDto>("/auth/logout", { refreshToken });
    return data;
  },

  async getMe(): Promise<UserResponseDto> {
    const { data } = await api.get<UserResponseDto>("/auth/me");
    return data;
  },

  async requestEmailVerification(email: string): Promise<OtpSentResponseDto> {
    const { data } = await api.post<OtpSentResponseDto>("/auth/verify-email/request", { email });
    return data;
  },

  async verifyEmail(payload: VerifyEmailOtpDto): Promise<MessageResponseDto> {
    const { data } = await api.post<MessageResponseDto>("/auth/verify-email/verify", payload);
    return data;
  },

  async requestPasswordReset(email: string): Promise<OtpSentResponseDto> {
    const { data } = await api.post<OtpSentResponseDto>("/auth/password-reset/request", { email });
    return data;
  },

  async verifyPasswordReset(
    payload: PasswordResetVerifyDto
  ): Promise<{ message: string; resetToken: string; success: boolean }> {
    const { data } = await api.post<{ message: string; resetToken: string; success: boolean }>(
      "/auth/password-reset/verify",
      payload
    );
    return data;
  },

  async completePasswordReset(payload: PasswordResetCompleteDto): Promise<MessageResponseDto> {
    const { data } = await api.post<MessageResponseDto>("/auth/password-reset/complete", payload);
    return data;
  },
};
