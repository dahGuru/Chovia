import crypto from "node:crypto";
import { prisma } from "../../database/prisma.js";
import { atomicConsumeToken, cacheDel, cacheGet, cacheSet } from "../../cache/redis.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "../../common/errors/api-error.js";
import { hashPassword, comparePassword } from "../../utils/password.js";
import {
  generateSecureToken,
  generateFamilyId,
  generateNumericOtp,
  createOtpSignature,
  verifyOtpSignature,
} from "../../utils/crypto.js";
import { env } from "../../config/env.js";
import { emailService } from "../../integrations/email/email.service.js";
import type { AuthUserPayload } from "../../types/auth.js";
import type {
  RegisterRequestDto,
  RiderRegisterRequestDto,
  RiderRegisterResponseDto,
  LoginRequestDto,
  UserResponseDto,
  AuthResponseDto,
  OtpSentResponseDto,
  MessageResponseDto,
} from "./dto/auth.dto.js";

function serializeUser(user: {
  id: string;
  email: string;
  name: string;
  role: "CUSTOMER" | "RESTAURANT_STAFF" | "RIDER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
  emailVerified: boolean;
  phone: string;
  createdAt: Date;
}): UserResponseDto {
  const parts = user.name.split(" ");
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ") || "";

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerified: user.emailVerified,
    phoneVerified: false,
    firstName,
    lastName,
    phone: user.phone,
    createdAt: user.createdAt.toISOString(),
  };
}

export class AuthService {
  private getActiveOtpKey(action: "VERIFY_EMAIL" | "PASSWORD_RESET", email: string): string {
    return `active_otp:${action}:${email.toLowerCase()}`;
  }

  private hashTokenForChallenge(signedToken: string): string {
    return crypto.createHash("sha256").update(signedToken).digest("hex");
  }

  private async recordActiveOtpChallenge(
    action: "VERIFY_EMAIL" | "PASSWORD_RESET",
    email: string,
    signedToken: string
  ): Promise<void> {
    if (!signedToken) return;
    await cacheSet(
      this.getActiveOtpKey(action, email),
      this.hashTokenForChallenge(signedToken),
      env.OTP_EXPIRES_IN_MINUTES * 60
    );
  }

  private async ensureOtpNotSuperseded(
    action: "VERIFY_EMAIL" | "PASSWORD_RESET",
    email: string,
    signedToken: string
  ): Promise<void> {
    const activeHash = await cacheGet(this.getActiveOtpKey(action, email));
    if (activeHash && activeHash !== this.hashTokenForChallenge(signedToken)) {
      throw new BadRequestError(
        "This verification code has been superseded by a newer code. Please use the latest code sent to your email."
      );
    }
  }

  async register(
    dto: RegisterRequestDto
  ): Promise<{ user: UserResponseDto; otpData: OtpSentResponseDto }> {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { phone: dto.phone }],
      },
    });

    if (existing) {
      if (existing.email === dto.email) {
        throw new ConflictError("Email is already registered");
      }
      throw new ConflictError("Phone number is already registered");
    }

    const passwordHash = await hashPassword(dto.password);
    const fullName = `${dto.firstName} ${dto.lastName}`.trim();

    const user = await prisma.user.create({
      data: {
        name: fullName,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        role: "CUSTOMER",
        status: "ACTIVE",
        emailVerified: false,
        customerProfile: {
          create: {
            firstName: dto.firstName,
            lastName: dto.lastName,
          },
        },
      },
    });

    const otp = generateNumericOtp();
    const { signedToken } = createOtpSignature(dto.email, otp, "VERIFY_EMAIL");
    await this.recordActiveOtpChallenge("VERIFY_EMAIL", dto.email, signedToken);
    await emailService.sendVerificationEmail(dto.email, otp);

    return {
      user: serializeUser(user),
      otpData: {
        message: "Registration successful. Please verify your email.",
        signedToken,
        expiresInMinutes: env.OTP_EXPIRES_IN_MINUTES,
      },
    };
  }

  async registerRider(dto: RiderRegisterRequestDto): Promise<RiderRegisterResponseDto> {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { phone: dto.phone }],
      },
    });

    if (existing) {
      if (existing.email === dto.email) {
        throw new ConflictError("Email is already registered");
      }
      throw new ConflictError("Phone number is already registered");
    }

    const passwordHash = await hashPassword(dto.password);
    const fullName = `${dto.firstName} ${dto.lastName}`.trim();

    const user = await prisma.user.create({
      data: {
        name: fullName,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        role: "RIDER",
        status: "ACTIVE",
        emailVerified: false,
        riderProfile: {
          create: {
            firstName: dto.firstName,
            lastName: dto.lastName,
            status: "PENDING",
            isOnline: false,
            isAvailable: false,
          },
        },
      },
      include: {
        riderProfile: true,
      },
    });

    const otp = generateNumericOtp();
    const { signedToken } = createOtpSignature(dto.email, otp, "VERIFY_EMAIL");
    await this.recordActiveOtpChallenge("VERIFY_EMAIL", dto.email, signedToken);
    let emailDeliveryStatus: "SENT" | "FAILED_RETRYABLE" = "SENT";

    try {
      await emailService.sendVerificationEmail(dto.email, otp);
    } catch {
      emailDeliveryStatus = "FAILED_RETRYABLE";
    }

    return {
      user: serializeUser(user),
      riderProfile: {
        id: user.riderProfile!.id,
        status: user.riderProfile!.status,
        isOnline: user.riderProfile!.isOnline,
        isAvailable: user.riderProfile!.isAvailable,
      },
      emailDeliveryStatus,
      otpData: {
        message:
          emailDeliveryStatus === "SENT"
            ? "Rider registration successful. Please verify your email."
            : "Rider account created, but verification email could not be sent right now. Please tap Resend Code.",
        signedToken,
        expiresInMinutes: env.OTP_EXPIRES_IN_MINUTES,
      },
    };
  }

  async login(
    dto: LoginRequestDto,
    signToken: (payload: AuthUserPayload) => string
  ): Promise<AuthResponseDto> {
    const user = await prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const isMatch = await comparePassword(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError("Invalid email or password");
    }

    if (user.status !== "ACTIVE") {
      throw new ForbiddenError("Account is not active");
    }

    if (!user.emailVerified) {
      throw new ForbiddenError("Please verify your email address before logging in");
    }

    const accessToken = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    });

    const rawRefreshToken = generateSecureToken(32);
    const tokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");
    const familyId = generateFamilyId();
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_EXPIRES_IN_DAYS * 86400000);

    let deviceId: string | undefined;
    if (dto.deviceInfo?.pushToken) {
      const createData: Record<string, unknown> = {
        userId: user.id,
        expoPushToken: dto.deviceInfo.pushToken,
        platform: dto.deviceInfo.deviceType.toLowerCase(),
        isActive: true,
        lastSeenAt: new Date(),
      };
      if (dto.deviceInfo.deviceName) {
        createData.deviceName = dto.deviceInfo.deviceName;
      }

      const updateData: Record<string, unknown> = {
        userId: user.id,
        platform: dto.deviceInfo.deviceType.toLowerCase(),
        isActive: true,
        lastSeenAt: new Date(),
      };
      if (dto.deviceInfo.deviceName) {
        updateData.deviceName = dto.deviceInfo.deviceName;
      }

      const device = await prisma.userDevice.upsert({
        where: {
          expoPushToken: dto.deviceInfo.pushToken,
        },
        create: createData as Parameters<typeof prisma.userDevice.upsert>[0]["create"],
        update: updateData as Parameters<typeof prisma.userDevice.upsert>[0]["update"],
      });
      deviceId = device.id;
    }

    const refreshData: Record<string, unknown> = {
      userId: user.id,
      tokenHash,
      familyId,
      expiresAt,
    };
    if (deviceId) {
      refreshData.deviceId = deviceId;
    }

    await prisma.refreshToken.create({
      data: refreshData as Parameters<typeof prisma.refreshToken.create>[0]["data"],
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: serializeUser(user),
    };
  }

  async refresh(
    rawRefreshToken: string,
    signToken: (payload: AuthUserPayload) => string
  ): Promise<AuthResponseDto> {
    const tokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");

    const token = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!token) {
      throw new UnauthorizedError("Invalid refresh token");
    }

    if (token.revokedAt !== null) {
      // Family revocation on reuse detection
      await prisma.refreshToken.updateMany({
        where: { familyId: token.familyId },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedError("Compromised session. All tokens in session family revoked.");
    }

    if (new Date() > token.expiresAt) {
      throw new UnauthorizedError("Refresh token has expired");
    }

    if (token.user.status !== "ACTIVE") {
      throw new ForbiddenError("User account is not active");
    }

    const newRawRefreshToken = generateSecureToken(32);
    const newTokenHash = crypto.createHash("sha256").update(newRawRefreshToken).digest("hex");
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_EXPIRES_IN_DAYS * 86400000);

    const createRefreshData: Record<string, unknown> = {
      userId: token.userId,
      tokenHash: newTokenHash,
      familyId: token.familyId,
      expiresAt,
    };
    if (token.deviceId) {
      createRefreshData.deviceId = token.deviceId;
    }

    const [createdNew] = await prisma.$transaction([
      prisma.refreshToken.create({
        data: createRefreshData as Parameters<typeof prisma.refreshToken.create>[0]["data"],
      }),
      prisma.refreshToken.update({
        where: { id: token.id },
        data: {
          revokedAt: new Date(),
        },
      }),
    ]);

    await prisma.refreshToken.update({
      where: { id: token.id },
      data: { replacedByTokenId: createdNew.id },
    });

    const accessToken = signToken({
      id: token.user.id,
      email: token.user.email,
      role: token.user.role,
      status: token.user.status,
    });

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
      user: serializeUser(token.user),
    };
  }

  async logout(rawRefreshToken: string): Promise<MessageResponseDto> {
    const tokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");

    const token = await prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (token && !token.revokedAt) {
      await prisma.refreshToken.update({
        where: { id: token.id },
        data: { revokedAt: new Date() },
      });
    }

    return { message: "Logged out successfully", success: true };
  }

  async requestEmailVerification(email: string): Promise<OtpSentResponseDto> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return {
        message: "If your email is registered and unverified, a verification code has been sent",
        signedToken: "",
        expiresInMinutes: env.OTP_EXPIRES_IN_MINUTES,
      };
    }

    if (user.emailVerified) {
      return {
        message: "Email address is already verified",
        signedToken: "",
        expiresInMinutes: env.OTP_EXPIRES_IN_MINUTES,
      };
    }

    const otp = generateNumericOtp();
    const { signedToken } = createOtpSignature(email, otp, "VERIFY_EMAIL");
    await this.recordActiveOtpChallenge("VERIFY_EMAIL", email, signedToken);
    await emailService.sendVerificationEmail(email, otp);

    return {
      message: "Verification code sent to email",
      signedToken,
      expiresInMinutes: env.OTP_EXPIRES_IN_MINUTES,
    };
  }

  async verifyEmail(email: string, otp: string, signedToken: string): Promise<MessageResponseDto> {
    const result = verifyOtpSignature(email, otp, "VERIFY_EMAIL", signedToken);
    if (!result.valid) {
      throw new BadRequestError(
        result.reason === "EXPIRED" ? "Verification code has expired" : "Invalid verification code"
      );
    }

    await this.ensureOtpNotSuperseded("VERIFY_EMAIL", email, signedToken);

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerified: true },
    });
    if (!user) {
      throw new BadRequestError("Invalid verification code");
    }

    const replayKey = `consumed_otp:${signedToken}`;
    const consumed = await atomicConsumeToken(replayKey, env.OTP_EXPIRES_IN_MINUTES * 60);
    if (!consumed) {
      throw new BadRequestError("This verification code has already been consumed");
    }

    if (user.emailVerified) {
      await cacheDel(this.getActiveOtpKey("VERIFY_EMAIL", email)).catch(() => undefined);
      return { message: "Email address is already verified", success: true };
    }

    await prisma.user.update({
      where: { email },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
    await cacheDel(this.getActiveOtpKey("VERIFY_EMAIL", email)).catch(() => undefined);

    return { message: "Email verified successfully", success: true };
  }

  async requestPasswordReset(email: string): Promise<OtpSentResponseDto> {
    const user = await prisma.user.findUnique({ where: { email } });
    const otp = generateNumericOtp();
    const { signedToken } = createOtpSignature(email, otp, "PASSWORD_RESET");

    if (user) {
      await this.recordActiveOtpChallenge("PASSWORD_RESET", email, signedToken);
      await emailService.sendPasswordResetEmail(email, otp);
    }

    return {
      message: "If your email is registered, a password reset code has been sent",
      signedToken,
      expiresInMinutes: env.OTP_EXPIRES_IN_MINUTES,
    };
  }

  async verifyPasswordReset(
    email: string,
    otp: string,
    signedToken: string
  ): Promise<{ message: string; resetToken: string; success: boolean }> {
    const result = verifyOtpSignature(email, otp, "PASSWORD_RESET", signedToken);
    if (!result.valid) {
      throw new BadRequestError(
        result.reason === "EXPIRED" ? "Reset code has expired" : "Invalid reset code"
      );
    }

    await this.ensureOtpNotSuperseded("PASSWORD_RESET", email, signedToken);

    const replayKey = `consumed_otp:${signedToken}`;
    const consumed = await atomicConsumeToken(replayKey, env.OTP_EXPIRES_IN_MINUTES * 60);
    if (!consumed) {
      throw new BadRequestError("This reset code has already been consumed");
    }
    await cacheDel(this.getActiveOtpKey("PASSWORD_RESET", email)).catch(() => undefined);

    // Single-use reset authorization token valid for 15 minutes
    const resetExpiresAt = Date.now() + 15 * 60 * 1000;
    const hmac = crypto
      .createHmac("sha256", env.OTP_HMAC_SECRET)
      .update(`RESET_AUTH:${email}:${resetExpiresAt}`)
      .digest("hex");
    const resetToken = `${resetExpiresAt}.${hmac}`;

    return { message: "Reset code verified", resetToken, success: true };
  }

  async completePasswordReset(
    email: string,
    resetToken: string,
    newPassword: string
  ): Promise<MessageResponseDto> {
    const parts = resetToken.split(".");
    if (parts.length !== 2) {
      throw new BadRequestError("Invalid reset token");
    }

    const expiresAtStr = parts[0] || "";
    const sig = parts[1] || "";
    const expiresAt = Number.parseInt(expiresAtStr, 10);
    if (Date.now() > expiresAt) {
      throw new BadRequestError("Reset token has expired");
    }

    const expectedHmac = crypto
      .createHmac("sha256", env.OTP_HMAC_SECRET)
      .update(`RESET_AUTH:${email}:${expiresAt}`)
      .digest("hex");

    const expectedBuf = Buffer.from(expectedHmac, "hex");
    const actualBuf = Buffer.from(sig, "hex");
    if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
      throw new BadRequestError("Invalid reset token signature");
    }

    const resetAuthKey = `consumed_reset_token:${resetToken}`;
    const consumed = await atomicConsumeToken(resetAuthKey, 15 * 60);
    if (!consumed) {
      throw new BadRequestError("This reset authorization token has already been consumed");
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      // Revoke all existing sessions for security
      prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return {
      message: "Password reset successful. Please log in with your new password.",
      success: true,
    };
  }

  async getMe(userId: string): Promise<UserResponseDto> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    return serializeUser(user);
  }
}

export const authService = new AuthService();
