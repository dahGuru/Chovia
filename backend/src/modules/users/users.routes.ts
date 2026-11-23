import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import "../../types/auth.js";
import { prisma } from "../../database/prisma.js";
import { BadRequestError, ForbiddenError } from "../../common/errors/api-error.js";
import { usersService } from "./users.service.js";
import {
  updateUserRequestSchema,
  registerDeviceRequestSchema,
  uploadSignatureRequestSchema,
  uploadSignatureResponseSchema,
  uploadImageRequestSchema,
  verifyUploadRequestSchema,
  verifyUploadResponseSchema,
  userResponseSchema,
  deviceResponseSchema,
} from "./dto/user.dto.js";
import { cloudinaryService, type AllowedFolder } from "../../integrations/cloudinary/cloudinary.service.js";

async function verifyUploadAuthorization(
  user: { id: string; role: string },
  folder: AllowedFolder,
  restaurantId?: string
) {
  if (user.role === "CUSTOMER") {
    if (folder !== "avatars") {
      throw new ForbiddenError("Customers are only authorized to upload avatar images");
    }
  } else if (user.role === "RIDER") {
    if (folder !== "avatars" && folder !== "documents") {
      throw new ForbiddenError("Riders are only authorized to upload avatars and verification documents");
    }
  } else if (user.role === "RESTAURANT_STAFF") {
    if (folder === "restaurants" || folder === "menu") {
      if (!restaurantId) {
        throw new BadRequestError("restaurantId is required when uploading restaurant or menu assets");
      }
      const membership = await prisma.restaurantStaffMembership.findFirst({
        where: {
          userId: user.id,
          restaurantId,
          status: "ACTIVE",
        },
      });
      if (!membership) {
        throw new ForbiddenError("You are not authorized to upload assets for this restaurant");
      }
    } else if (folder !== "avatars") {
      throw new ForbiddenError("Restaurant staff are only authorized to upload avatars, restaurant, or menu assets");
    }
  }
}

export const usersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get(
    "/profile",
    {
      schema: {
        description: "Get authenticated user profile",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        response: {
          200: userResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const profile = await usersService.getProfile(request.user.id);
      return reply.status(200).send(profile);
    }
  );

  fastify.patch(
    "/profile",
    {
      schema: {
        description: "Update authenticated user profile",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        body: updateUserRequestSchema,
        response: {
          200: userResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = updateUserRequestSchema.parse(request.body);
      const updated = await usersService.updateProfile(request.user.id, body);
      return reply.status(200).send(updated);
    }
  );

  fastify.get(
    "/devices",
    {
      schema: {
        description: "List registered devices for authenticated user",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        response: {
          200: z.array(deviceResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const devices = await usersService.listDevices(request.user.id);
      return reply.status(200).send(devices);
    }
  );

  fastify.post(
    "/devices",
    {
      schema: {
        description: "Register or update user device push token",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        body: registerDeviceRequestSchema,
        response: {
          200: deviceResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = registerDeviceRequestSchema.parse(request.body);
      const device = await usersService.registerDevice(request.user.id, body);
      return reply.status(200).send(device);
    }
  );

  fastify.delete(
    "/devices/:deviceId",
    {
      schema: {
        description: "Unregister user device session",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        params: z.object({ deviceId: z.string().uuid() }),
        response: {
          200: z.object({ message: z.string(), success: z.boolean() }),
        },
      },
    },
    async (request, reply) => {
      const { deviceId } = request.params as { deviceId: string };
      const result = await usersService.deleteDevice(request.user.id, deviceId);
      return reply.status(200).send(result);
    }
  );

  fastify.post(
    "/upload-signature",
    {
      schema: {
        description: "Generate signed Cloudinary upload parameters for direct client upload",
        tags: ["Users", "Uploads"],
        security: [{ bearerAuth: [] }],
        body: uploadSignatureRequestSchema,
        response: {
          200: uploadSignatureResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = uploadSignatureRequestSchema.parse(request.body);
      await verifyUploadAuthorization(request.user, body.folder, body.restaurantId);
      cloudinaryService.validateUploadMetadata(body.folder, body.mimeType, body.fileSizeBytes);

      const signature = cloudinaryService.generateUploadSignature(body.folder, body.customPublicId);
      return reply.status(200).send(signature);
    }
  );

  fastify.post(
    "/upload-image",
    {
      schema: {
        description: "Upload image directly to Cloudinary via server",
        tags: ["Users", "Uploads"],
        security: [{ bearerAuth: [] }],
        body: uploadImageRequestSchema,
        response: {
          200: z.object({
            publicId: z.string(),
            secureUrl: z.string(),
            width: z.number().optional(),
            height: z.number().optional(),
            format: z.string().optional(),
            bytes: z.number().optional(),
          }),
        },
      },
    },
    async (request, reply) => {
      const body = uploadImageRequestSchema.parse(request.body);
      await verifyUploadAuthorization(request.user, body.folder, body.restaurantId);
      cloudinaryService.validateUploadMetadata(body.folder, body.mimeType, body.fileSizeBytes);

      const result = await cloudinaryService.uploadImage(body.file, body.folder, body.customPublicId);
      return reply.status(200).send(result);
    }
  );

  fastify.post(
    "/verify-upload",
    {
      schema: {
        description: "Verify completed client direct upload to Cloudinary",
        tags: ["Users", "Uploads"],
        security: [{ bearerAuth: [] }],
        body: verifyUploadRequestSchema,
        response: {
          200: verifyUploadResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = verifyUploadRequestSchema.parse(request.body);
      await verifyUploadAuthorization(request.user, body.folder, body.restaurantId);
      cloudinaryService.verifyUploadResponse(body.folder, {
        publicId: body.publicId,
        format: body.format,
        bytes: body.bytes,
        resourceType: body.resourceType,
      });

      return reply.status(200).send({
        verified: true,
        folder: body.folder,
        publicId: body.publicId,
      });
    }
  );
};
