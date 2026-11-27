/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../database/prisma.js";
import { authService } from "../modules/auth/auth.service.js";
import { ordersService } from "../modules/orders/orders.service.js";
import { restaurantsService } from "../modules/restaurants/restaurants.service.js";
import { emailService } from "../integrations/email/email.service.js";
import { outboxDispatcher } from "../jobs/outbox/outbox.dispatcher.js";
import * as redisCache from "../cache/redis.js";
import { BadRequestError, ForbiddenError } from "../common/errors/api-error.js";

describe("Restaurant Order Authorization & Onboarding Security", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(outboxDispatcher, "dispatchPendingEvents").mockResolvedValue(0);
  });

  describe("1. Restaurant Order Action Authorization (accept, ready, reject)", () => {
    const orderId = "11111111-1111-4111-8111-111111111111";
    const restaurantAId = "22222222-2222-4222-8222-222222222222";
    const customerUserId = "33333333-3333-4333-8333-333333333333";
    const otherStaffUserId = "44444444-4444-4444-8444-444444444444";
    const ownerStaffUserId = "55555555-5555-4555-8555-555555555555";

    it("rejects CUSTOMER and RIDER at HTTP route boundary with 403 Forbidden", async () => {
      const app = await buildApp();
      await app.ready();
      try {
        const customerToken = app.jwt.sign({
          id: customerUserId,
          email: "cust@chovia.app",
          role: "CUSTOMER",
          status: "ACTIVE",
        });
        const riderToken = app.jwt.sign({
          id: "66666666-6666-4666-8666-666666666666",
          email: "rider@chovia.app",
          role: "RIDER",
          status: "ACTIVE",
        });

        for (const path of [`/api/v1/orders/${orderId}/accept`, `/api/v1/orders/${orderId}/ready`]) {
          const resCust = await app.inject({
            method: "POST",
            url: path,
            headers: { authorization: `Bearer ${customerToken}` },
          });
          expect(resCust.statusCode).toBe(403);

          const resRider = await app.inject({
            method: "POST",
            url: path,
            headers: { authorization: `Bearer ${riderToken}` },
          });
          expect(resRider.statusCode).toBe(403);
        }

        const resRejectCust = await app.inject({
          method: "POST",
          url: `/api/v1/orders/${orderId}/reject`,
          headers: { authorization: `Bearer ${customerToken}` },
          payload: { reason: "No ingredients" },
        });
        expect(resRejectCust.statusCode).toBe(403);
      } finally {
        await app.close();
      }
    });

    it("rejects RESTAURANT_STAFF from a different restaurant on accept, ready, and reject", async () => {
      vi.spyOn(prisma.order, "findUnique").mockResolvedValue({
        id: orderId,
        restaurantId: restaurantAId,
        orderNumber: "CHV-101",
        status: "CONFIRMED",
        customer: { userId: customerUserId },
        delivery: { id: "deliv-1" },
      } as any);
      vi.spyOn(prisma.restaurantStaffMembership, "findFirst").mockResolvedValue(null);

      await expect(
        ordersService.acceptOrder(otherStaffUserId, "RESTAURANT_STAFF", orderId)
      ).rejects.toThrow(ForbiddenError);

      await expect(
        ordersService.markOrderReady(otherStaffUserId, "RESTAURANT_STAFF", orderId)
      ).rejects.toThrow(ForbiddenError);

      await expect(
        ordersService.rejectOrder(otherStaffUserId, "RESTAURANT_STAFF", orderId, {
          reason: "Closed",
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("enforces valid status transitions and succeeds for active owning restaurant staff", async () => {
      vi.spyOn(prisma.restaurantStaffMembership, "findFirst").mockResolvedValue({
        id: "mem-1",
        userId: ownerStaffUserId,
        restaurantId: restaurantAId,
        status: "ACTIVE",
      } as any);

      // Invalid transition: PENDING_PAYMENT cannot be accepted
      vi.spyOn(prisma.order, "findUnique").mockResolvedValueOnce({
        id: orderId,
        restaurantId: restaurantAId,
        orderNumber: "CHV-102",
        status: "PENDING_PAYMENT",
        customer: { userId: customerUserId },
      } as any);

      await expect(
        ordersService.acceptOrder(ownerStaffUserId, "RESTAURANT_STAFF", orderId)
      ).rejects.toThrow(BadRequestError);

      // Valid transition: CONFIRMED -> PREPARING
      vi.spyOn(prisma.order, "findUnique").mockResolvedValueOnce({
        id: orderId,
        restaurantId: restaurantAId,
        orderNumber: "CHV-102",
        status: "CONFIRMED",
        customer: { userId: customerUserId },
      } as any);

      const notifCreateSpy = vi.fn().mockResolvedValue({});
      vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (cb: any) => {
        return cb({
          order: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findUniqueOrThrow: vi.fn().mockResolvedValue({
              id: orderId,
              orderNumber: "CHV-102",
              restaurantId: restaurantAId,
              customerId: "cust-prof-1",
              status: "PREPARING",
              subtotal: 2000,
              deliveryFee: 500,
              totalAmount: 2600,
              deliveryAddressText: "10 Market Rd",
              items: [],
              statusHistory: [],
              restaurant: { name: "Jollof Place" },
              createdAt: new Date("2026-11-27T10:00:00.000Z"),
            }),
          },
          orderStatusHistory: { create: vi.fn().mockResolvedValue({}) },
          notification: { create: notifCreateSpy },
        });
      });

      const accepted = await ordersService.acceptOrder(
        ownerStaffUserId,
        "RESTAURANT_STAFF",
        orderId
      );
      expect(accepted.status).toBe("PREPARING");
      expect(notifCreateSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("2. Restaurant Onboarding, Ownership & GET /restaurants/mine", () => {
    it("registers RESTAURANT_STAFF user via /auth/restaurant/register with unverified email", async () => {
      vi.spyOn(prisma.user, "findFirst").mockResolvedValue(null);
      vi.spyOn(redisCache, "cacheSet").mockResolvedValue(undefined);
      vi.spyOn(emailService, "sendVerificationEmail").mockResolvedValue(undefined);
      const createSpy = vi.spyOn(prisma.user, "create").mockResolvedValue({
        id: "77777777-7777-4777-8777-777777777777",
        email: "partner@chovia.app",
        name: "Ada Obi",
        role: "RESTAURANT_STAFF",
        status: "ACTIVE",
        emailVerified: false,
        phone: "+2348012345678",
        createdAt: new Date("2026-11-27T10:00:00.000Z"),
      } as any);

      const res = await authService.registerRestaurant({
        firstName: "Ada",
        lastName: "Obi",
        email: "partner@chovia.app",
        phone: "+2348012345678",
        password: "Password123",
      });

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: "RESTAURANT_STAFF",
            emailVerified: false,
          }),
        })
      );
      expect(res.user.role).toBe("RESTAURANT_STAFF");
      expect(res.emailDeliveryStatus).toBe("SENT");
    });

    it("blocks CUSTOMER from calling POST /restaurants and never promotes their role", async () => {
      const app = await buildApp();
      await app.ready();
      try {
        const customerToken = app.jwt.sign({
          id: "33333333-3333-4333-8333-333333333333",
          email: "cust@chovia.app",
          role: "CUSTOMER",
          status: "ACTIVE",
        });

        const res = await app.inject({
          method: "POST",
          url: "/api/v1/restaurants",
          headers: { authorization: `Bearer ${customerToken}` },
          payload: {
            name: "Unauthorized Kitchen",
            phone: "+2348012345678",
            address: "10 Ring Rd, Benin",
            latitude: 6.335,
            longitude: 5.6037,
            maxDeliveryDistanceKm: 10,
          },
        });

        expect(res.statusCode).toBe(403);
      } finally {
        await app.close();
      }
    });

    it("returns only actively managed restaurants (including pending applications) on GET /restaurants/mine", async () => {
      vi.spyOn(prisma.restaurantStaffMembership, "findMany").mockResolvedValue([
        {
          id: "mem-1",
          userId: "55555555-5555-4555-8555-555555555555",
          restaurantId: "22222222-2222-4222-8222-222222222222",
          status: "ACTIVE",
          restaurant: {
            id: "22222222-2222-4222-8222-222222222222",
            name: "Pending Kitchen",
            description: null,
            logoUrl: null,
            coverImageUrl: null,
            phone: "+2348012345678",
            email: "kitchen@chovia.app",
            address: "10 Ring Rd",
            latitude: 6.335,
            longitude: 5.6037,
            maxDeliveryDistanceKm: 10,
            status: "PENDING_APPROVAL",
            availability: "CLOSED",
            manualClosure: false,
            rejectionReason: null,
            cuisines: [],
            createdAt: new Date("2026-11-27T10:00:00.000Z"),
          },
        },
      ] as any);

      const list = await restaurantsService.listMine(
        "55555555-5555-4555-8555-555555555555",
        "RESTAURANT_STAFF"
      );
      expect(list).toHaveLength(1);
      expect(list[0]?.status).toBe("PENDING_APPROVAL");

      await expect(
        restaurantsService.listMine("33333333-3333-4333-8333-333333333333", "CUSTOMER")
      ).rejects.toThrow(ForbiddenError);
    });
  });
});
