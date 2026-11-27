import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { AuthUserPayload } from "../../types/auth.js";
import { authService } from "./auth.service.js";
import {
  registerRequestSchema,
  riderRegisterRequestSchema,
  riderRegisterResponseSchema,
  restaurantRegisterRequestSchema,
  restaurantRegisterResponseSchema,
  loginRequestSchema,
  refreshTokenRequestSchema,
  logoutRequestSchema,
  verifyEmailRequestSchema,
  verifyEmailOtpSchema,
  passwordResetRequestSchema,
  passwordResetVerifySchema,
  passwordResetCompleteSchema,
  authResponseSchema,
  userResponseSchema,
  otpSentResponseSchema,
  messageResponseSchema,
} from "./dto/auth.dto.js";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/register",
    {
      schema: {
        description: "Register a new customer account",
        tags: ["Auth"],
        body: registerRequestSchema,
        response: {
          201: z.object({
            user: userResponseSchema,
            otpData: otpSentResponseSchema,
          }),
        },
      },
    },
    async (request, reply) => {
      const body = registerRequestSchema.parse(request.body);
      const result = await authService.register(body);
      return reply.status(201).send(result);
    }
  );

  fastify.post(
    "/rider/register",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
      schema: {
        description: "Register a new rider account with a PENDING rider profile",
        tags: ["Auth"],
        body: riderRegisterRequestSchema,
        response: {
          201: riderRegisterResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = riderRegisterRequestSchema.parse(request.body);
      const result = await authService.registerRider(body);
      return reply.status(201).send(result);
    }
  );

  fastify.post(
    "/restaurant/register",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
      schema: {
        description: "Register a new restaurant partner (RESTAURANT_STAFF) account",
        tags: ["Auth"],
        body: restaurantRegisterRequestSchema,
        response: {
          201: restaurantRegisterResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = restaurantRegisterRequestSchema.parse(request.body);
      const result = await authService.registerRestaurant(body);
      return reply.status(201).send(result);
    }
  );

  fastify.post(
    "/login",
    {
      schema: {
        description: "Log in with email and password",
        tags: ["Auth"],
        body: loginRequestSchema,
        response: {
          200: authResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = loginRequestSchema.parse(request.body);
      const signToken = (payload: AuthUserPayload) =>
        fastify.jwt.sign(payload);
      const result = await authService.login(body, signToken);
      return reply.status(200).send(result);
    }
  );

  fastify.post(
    "/refresh",
    {
      schema: {
        description: "Rotate and obtain new access and refresh tokens",
        tags: ["Auth"],
        body: refreshTokenRequestSchema,
        response: {
          200: authResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = refreshTokenRequestSchema.parse(request.body);
      const signToken = (payload: AuthUserPayload) =>
        fastify.jwt.sign(payload);
      const result = await authService.refresh(body.refreshToken, signToken);
      return reply.status(200).send(result);
    }
  );

  fastify.post(
    "/logout",
    {
      schema: {
        description: "Log out and revoke refresh token session",
        tags: ["Auth"],
        body: logoutRequestSchema,
        response: {
          200: messageResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = logoutRequestSchema.parse(request.body);
      const result = await authService.logout(body.refreshToken);
      return reply.status(200).send(result);
    }
  );

  fastify.post(
    "/verify-email/request",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
        },
      },
      schema: {
        description: "Request an email verification OTP code",
        tags: ["Auth"],
        body: verifyEmailRequestSchema,
        response: {
          200: otpSentResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = verifyEmailRequestSchema.parse(request.body);
      const result = await authService.requestEmailVerification(body.email);
      return reply.status(200).send(result);
    }
  );

  fastify.post(
    "/verify-email/verify",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
      schema: {
        description: "Verify email with 6-digit OTP code",
        tags: ["Auth"],
        body: verifyEmailOtpSchema,
        response: {
          200: messageResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = verifyEmailOtpSchema.parse(request.body);
      const result = await authService.verifyEmail(body.email, body.otp, body.signedToken);
      return reply.status(200).send(result);
    }
  );

  fastify.post(
    "/password-reset/request",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
        },
      },
      schema: {
        description: "Request a password reset OTP code",
        tags: ["Auth"],
        body: passwordResetRequestSchema,
        response: {
          200: otpSentResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = passwordResetRequestSchema.parse(request.body);
      const result = await authService.requestPasswordReset(body.email);
      return reply.status(200).send(result);
    }
  );

  fastify.post(
    "/password-reset/verify",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
      schema: {
        description: "Verify password reset OTP and obtain reset token",
        tags: ["Auth"],
        body: passwordResetVerifySchema,
        response: {
          200: z.object({
            message: z.string(),
            resetToken: z.string(),
            success: z.boolean(),
          }),
        },
      },
    },
    async (request, reply) => {
      const body = passwordResetVerifySchema.parse(request.body);
      const result = await authService.verifyPasswordReset(body.email, body.otp, body.signedToken);
      return reply.status(200).send(result);
    }
  );

  fastify.post(
    "/password-reset/complete",
    {
      schema: {
        description: "Complete password reset using reset token",
        tags: ["Auth"],
        body: passwordResetCompleteSchema,
        response: {
          200: messageResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = passwordResetCompleteSchema.parse(request.body);
      const result = await authService.completePasswordReset(
        body.email,
        body.resetToken,
        body.newPassword
      );
      return reply.status(200).send(result);
    }
  );

  fastify.get(
    "/me",
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Get currently authenticated user profile",
        tags: ["Auth"],
        security: [{ bearerAuth: [] }],
        response: {
          200: userResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await authService.getMe(request.user.id);
      return reply.status(200).send(result);
    }
  );
};
