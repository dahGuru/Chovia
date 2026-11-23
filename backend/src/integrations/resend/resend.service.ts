import { Resend, type CreateEmailOptions } from "resend";
import { env } from "../../config/env.js";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  id: string;
  success: boolean;
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export class ResendService {
  private resend: Resend | null = null;
  private isConfigured: boolean;
  private isMock: boolean;

  constructor(options?: { apiKey?: string }) {
    const apiKey = options?.apiKey || env.RESEND_API_KEY || "";
    this.isConfigured = Boolean(apiKey && apiKey.startsWith("re_"));

    if (env.NODE_ENV === "production" || env.NODE_ENV === "staging") {
      if (!this.isConfigured) {
        throw new Error(`ResendService: Valid RESEND_API_KEY (re_...) is required in ${env.NODE_ENV}`);
      }
      this.isMock = false;
      this.resend = new Resend(apiKey);
    } else {
      this.isMock = Boolean(env.MOCK_INTEGRATIONS || apiKey.startsWith("re_test_mock"));
      if (this.isConfigured) {
        this.resend = new Resend(apiKey);
      }
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    if (this.isMock) {
      if (env.NODE_ENV === "production" || env.NODE_ENV === "staging") {
        throw new Error(`Mock email sending is strictly forbidden in ${env.NODE_ENV}`);
      }
      return {
        id: `mock_email_${Date.now()}`,
        success: true,
      };
    }

    if (!this.resend) {
      throw new Error("Resend email client is not configured");
    }

    const emailPayload: CreateEmailOptions = options.text
      ? {
          from: env.EMAIL_FROM,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        }
      : {
          from: env.EMAIL_FROM,
          to: options.to,
          subject: options.subject,
          html: options.html,
        };

    const { data, error } = await this.resend.emails.send(emailPayload);

    if (error) {
      throw new Error(`Resend email delivery failed: ${error.message}`);
    }

    return {
      id: data?.id || `email_${Date.now()}`,
      success: true,
    };
  }

  async sendVerificationOtp(email: string, otp: string): Promise<SendEmailResult> {
    const escapedOtp = escapeHtml(otp);
    const html = `
      <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0f172a; margin-top: 0;">Verify your CHOVIA account</h2>
        <p style="color: #475569; font-size: 16px;">Welcome to CHOVIA! Use the verification code below to verify your email address:</p>
        <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 16px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0284c7;">${escapedOtp}</span>
        </div>
        <p style="color: #64748b; font-size: 14px;">This code will expire in ${env.OTP_EXPIRES_IN_MINUTES} minutes. If you did not create a CHOVIA account, you can safely ignore this email.</p>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject: "CHOVIA — Verify Your Email Address",
      html,
      text: `Your CHOVIA verification code is: ${otp}. It expires in ${env.OTP_EXPIRES_IN_MINUTES} minutes.`,
    });
  }

  async sendPasswordResetOtp(email: string, otp: string): Promise<SendEmailResult> {
    const escapedOtp = escapeHtml(otp);
    const html = `
      <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0f172a; margin-top: 0;">Reset your CHOVIA password</h2>
        <p style="color: #475569; font-size: 16px;">A password reset was requested for your CHOVIA account. Use the code below to complete the reset:</p>
        <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 16px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #dc2626;">${escapedOtp}</span>
        </div>
        <p style="color: #64748b; font-size: 14px;">This code will expire in ${env.OTP_EXPIRES_IN_MINUTES} minutes. If you did not request this, please secure your account immediately.</p>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject: "CHOVIA — Password Reset Request",
      html,
      text: `Your CHOVIA password reset code is: ${otp}. It expires in ${env.OTP_EXPIRES_IN_MINUTES} minutes.`,
    });
  }

  async sendStaffInvitation(
    email: string,
    restaurantName: string,
    role: string,
    inviteToken: string
  ): Promise<SendEmailResult> {
    const escapedRestaurant = escapeHtml(restaurantName);
    const escapedRole = escapeHtml(role);
    const inviteUrl = `${env.FRONTEND_URL}/staff/invite?token=${encodeURIComponent(inviteToken)}`;

    const html = `
      <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0f172a; margin-top: 0;">You're invited to join ${escapedRestaurant}</h2>
        <p style="color: #475569; font-size: 16px;">You have been invited to join the staff team at <strong>${escapedRestaurant}</strong> as <strong>${escapedRole}</strong> on CHOVIA.</p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${inviteUrl}" style="background-color: #0284c7; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Accept Invitation</a>
        </div>
        <p style="color: #64748b; font-size: 13px;">Or paste this link into your browser: <br/>${inviteUrl}</p>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject: `CHOVIA — Invitation to join ${restaurantName}`,
      html,
      text: `You have been invited to join ${restaurantName} as ${role} on CHOVIA. Accept invite here: ${inviteUrl}`,
    });
  }
}

export const resendService = new ResendService();
