import type { FastifyRequest } from "fastify";
import "../types/auth.js";
import { ForbiddenError, UnauthorizedError } from "../common/errors/api-error.js";
import { prisma } from "../database/prisma.js";

export function authorize(allowedRoles: Array<"CUSTOMER" | "RESTAURANT_STAFF" | "RIDER" | "ADMIN">) {
  return async (request: FastifyRequest) => {
    if (!request.user) {
      throw new UnauthorizedError("Authentication required");
    }

    if (request.user.status !== "ACTIVE") {
      throw new ForbiddenError("Account is not active");
    }

    if (!allowedRoles.includes(request.user.role)) {
      throw new ForbiddenError("You do not have permission to access this resource");
    }
  };
}

export async function requireRestaurantStaff(request: FastifyRequest) {
  if (!request.user) {
    throw new UnauthorizedError("Authentication required");
  }

  if (request.user.role === "ADMIN") {
    // Admin has superuser access
    return;
  }

  if (request.user.role !== "RESTAURANT_STAFF") {
    throw new ForbiddenError("Only restaurant staff or administrators can perform this action");
  }

  const params = request.params as { restaurantId?: string; id?: string };
  const restaurantId = params.restaurantId || params.id;

  if (restaurantId) {
    const membership = await prisma.restaurantStaffMembership.findUnique({
      where: {
        userId_restaurantId: {
          userId: request.user.id,
          restaurantId,
        },
      },
    });

    if (!membership || membership.status !== "ACTIVE") {
      throw new ForbiddenError("You are not an active staff member of this restaurant");
    }
  }
}
