import crypto from "node:crypto";
import { prisma } from "../../database/prisma.js";
import {
  BadRequestError,
  NotFoundError,
} from "../../common/errors/api-error.js";
import { hashPassword } from "../../utils/password.js";
import { generateSecureToken } from "../../utils/crypto.js";
import { emailService } from "../../integrations/email/email.service.js";
import type {
  InviteStaffRequestDto,
  AcceptStaffInvitationRequestDto,
  StaffMemberResponseDto,
  StaffInvitationResponseDto,
} from "./dto/staff.dto.js";

export class RestaurantStaffService {
  async inviteStaff(
    restaurantId: string,
    invitedByUserId: string,
    dto: InviteStaffRequestDto
  ): Promise<StaffInvitationResponseDto> {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });

    if (!restaurant) {
      throw new NotFoundError("Restaurant not found");
    }

    const rawToken = generateSecureToken(32);
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 86400000); // 7 days

    const invitation = await prisma.staffInvitation.create({
      data: {
        email: dto.email,
        restaurantId,
        invitedByUserId,
        role: "RESTAURANT_STAFF",
        tokenHash,
        expiresAt,
      },
    });

    await emailService.sendStaffInvitationEmail(
      dto.email,
      restaurant.name,
      dto.role,
      rawToken
    );

    return {
      id: invitation.id,
      email: invitation.email,
      restaurantId: invitation.restaurantId,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
    };
  }

  async acceptInvitation(
    dto: AcceptStaffInvitationRequestDto
  ): Promise<{ message: string; success: boolean }> {
    const tokenHash = crypto.createHash("sha256").update(dto.token).digest("hex");

    const invitation = await prisma.staffInvitation.findUnique({
      where: { tokenHash },
      include: { restaurant: true },
    });

    if (!invitation || invitation.email !== dto.email) {
      throw new BadRequestError("Invalid invitation token or email");
    }

    if (invitation.revokedAt) {
      throw new BadRequestError("Invitation has been revoked");
    }

    if (invitation.acceptedAt) {
      throw new BadRequestError("Invitation has already been accepted");
    }

    if (new Date() > invitation.expiresAt) {
      throw new BadRequestError("Invitation has expired");
    }

    const passwordHash = await hashPassword(dto.password);
    const fullName = `${dto.firstName} ${dto.lastName}`.trim();

    await prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({ where: { email: dto.email } });

      if (user) {
        // Upgrade existing user or update password if staff
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            role: "RESTAURANT_STAFF",
            passwordHash,
          },
        });
      } else {
        user = await tx.user.create({
          data: {
            name: fullName,
            email: dto.email,
            phone: dto.phone,
            passwordHash,
            role: "RESTAURANT_STAFF",
            status: "ACTIVE",
            emailVerified: true,
          },
        });
      }

      await tx.restaurantStaffMembership.upsert({
        where: {
          userId_restaurantId: {
            userId: user.id,
            restaurantId: invitation.restaurantId,
          },
        },
        create: {
          userId: user.id,
          restaurantId: invitation.restaurantId,
          status: "ACTIVE",
        },
        update: {
          status: "ACTIVE",
        },
      });

      await tx.staffInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
    });

    return {
      message: "Staff invitation accepted successfully. You can now log in.",
      success: true,
    };
  }

  async listStaff(restaurantId: string): Promise<StaffMemberResponseDto[]> {
    const members = await prisma.restaurantStaffMembership.findMany({
      where: { restaurantId },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      phone: m.user.phone,
      status: m.status,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async revokeMembership(
    restaurantId: string,
    membershipId: string
  ): Promise<{ success: boolean }> {
    const membership = await prisma.restaurantStaffMembership.findUnique({
      where: { id: membershipId },
    });

    if (!membership || membership.restaurantId !== restaurantId) {
      throw new NotFoundError("Staff membership not found");
    }

    await prisma.restaurantStaffMembership.update({
      where: { id: membershipId },
      data: { status: "INACTIVE" },
    });

    return { success: true };
  }
}

export const restaurantStaffService = new RestaurantStaffService();
