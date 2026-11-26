import { prisma } from "../../database/prisma.js";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../../common/errors/api-error.js";
import { cloudinaryService } from "../../integrations/cloudinary/cloudinary.service.js";
import { encryptSensitiveValue, maskSensitiveDigits } from "../../utils/encryption.js";
import type {
  ListRiderKycApplicationsQueryDto,
  PaginatedRiderKycApplicationsDto,
  RiderKycApplicationResponseDto,
  SubmitRiderKycRequestDto,
} from "./dto/kyc.dto.js";

interface ApplicationRecordWithRelations {
  id: string;
  riderProfileId: string;
  status: "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
  firstName: string;
  lastName: string;
  phone: string;
  operatingCity: string;
  homeAddress: string | null;
  vehicleType: string;
  vehiclePlateNumber: string | null;
  governmentIdType: string;
  governmentIdMasked: string;
  bankName: string;
  bankCode: string | null;
  accountHolderName: string;
  bankAccountMasked: string;
  submittedAt: Date;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  reviewNotes: string | null;
  riderProfile: {
    status: "PENDING" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
    userId: string;
    user?: { email: string } | null;
  };
  documents: Array<{
    id: string;
    documentType: "GOVERNMENT_ID" | "DRIVER_LICENSE" | "VEHICLE_REGISTRATION" | "SELFIE";
    publicId: string;
    resourceType: string;
    deliveryType: string;
    format: string | null;
    bytes: number | null;
    verifiedAt: Date | null;
  }>;
}

function serializeKycApplication(
  app: ApplicationRecordWithRelations
): RiderKycApplicationResponseDto {
  return {
    id: app.id,
    riderProfileId: app.riderProfileId,
    userId: app.riderProfile.userId,
    ...(app.riderProfile.user?.email ? { email: app.riderProfile.user.email } : {}),
    status: app.status,
    riderStatus: app.riderProfile.status,
    firstName: app.firstName,
    lastName: app.lastName,
    phone: app.phone,
    operatingCity: app.operatingCity,
    homeAddress: app.homeAddress,
    vehicleType: app.vehicleType,
    vehiclePlateNumber: app.vehiclePlateNumber,
    governmentIdType: app.governmentIdType,
    governmentIdMasked: app.governmentIdMasked,
    bankName: app.bankName,
    bankCode: app.bankCode,
    accountHolderName: app.accountHolderName,
    bankAccountMasked: app.bankAccountMasked,
    submittedAt: app.submittedAt.toISOString(),
    reviewedAt: app.reviewedAt ? app.reviewedAt.toISOString() : null,
    rejectionReason: app.rejectionReason,
    reviewNotes: app.reviewNotes,
    documents: app.documents.map((doc) => ({
      id: doc.id,
      documentType: doc.documentType,
      publicId: doc.publicId,
      resourceType: doc.resourceType,
      deliveryType: doc.deliveryType,
      format: doc.format,
      bytes: doc.bytes,
      // Generate short-lived authenticated access URL on demand; never expose permanent public URLs
      signedAccessUrl: cloudinaryService.generateSignedAssetUrl(
        doc.publicId,
        doc.resourceType,
        doc.format ?? undefined
      ),
      verifiedAt: doc.verifiedAt ? doc.verifiedAt.toISOString() : null,
    })),
  };
}

export class RiderKycService {
  async submitApplication(
    userId: string,
    dto: SubmitRiderKycRequestDto
  ): Promise<RiderKycApplicationResponseDto> {
    const rider = await prisma.riderProfile.findUnique({
      where: { userId },
      include: {
        kycApplication: true,
        user: { select: { email: true } },
      },
    });

    if (!rider) {
      throw new ForbiddenError("Rider profile not found for this user");
    }

    if (rider.status === "SUSPENDED" || rider.status === "DEACTIVATED") {
      throw new ForbiddenError(
        `Cannot submit KYC while rider profile is ${rider.status.toLowerCase()}`
      );
    }

    if (rider.kycApplication?.status === "APPROVED" || rider.status === "ACTIVE") {
      throw new BadRequestError("Your KYC application has already been approved");
    }

    // Verify every submitted document with Cloudinary & confirm authenticated private delivery + user ownership
    const verifiedDocs = await Promise.all(
      dto.documents.map(async (doc) => {
        const verified = await cloudinaryService.verifyAssetWithProvider(
          doc.publicId,
          "documents",
          userId
        );
        return {
          documentType: doc.documentType,
          publicId: verified.publicId,
          resourceType: verified.resourceType || "image",
          deliveryType: verified.deliveryType || "authenticated",
          format: verified.format ?? null,
          bytes: verified.bytes ?? null,
          verifiedAt: new Date(),
        };
      })
    );

    const encryptedGovernmentId = encryptSensitiveValue(dto.governmentIdNumber);
    const governmentIdMasked = maskSensitiveDigits(dto.governmentIdNumber);
    const encryptedBankAccountNumber = encryptSensitiveValue(dto.bankAccountNumber);
    const bankAccountMasked = maskSensitiveDigits(dto.bankAccountNumber);

    const saved = await prisma.$transaction(async (tx) => {
      await tx.riderProfile.update({
        where: { id: rider.id },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          operatingCity: dto.operatingCity,
          vehicleType: dto.vehicleType,
          vehiclePlateNumber: dto.vehiclePlateNumber ?? null,
          status: "PENDING",
          isOnline: false,
          isAvailable: false,
        },
      });

      const app = await tx.riderKycApplication.upsert({
        where: { riderProfileId: rider.id },
        create: {
          riderProfileId: rider.id,
          status: "UNDER_REVIEW",
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          operatingCity: dto.operatingCity,
          homeAddress: dto.homeAddress ?? null,
          vehicleType: dto.vehicleType,
          vehiclePlateNumber: dto.vehiclePlateNumber ?? null,
          governmentIdType: dto.governmentIdType,
          encryptedGovernmentId,
          governmentIdMasked,
          bankName: dto.bankName,
          bankCode: dto.bankCode ?? null,
          accountHolderName: dto.accountHolderName,
          encryptedBankAccountNumber,
          bankAccountMasked,
          submittedAt: new Date(),
        },
        update: {
          status: "UNDER_REVIEW",
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          operatingCity: dto.operatingCity,
          homeAddress: dto.homeAddress ?? null,
          vehicleType: dto.vehicleType,
          vehiclePlateNumber: dto.vehiclePlateNumber ?? null,
          governmentIdType: dto.governmentIdType,
          encryptedGovernmentId,
          governmentIdMasked,
          bankName: dto.bankName,
          bankCode: dto.bankCode ?? null,
          accountHolderName: dto.accountHolderName,
          encryptedBankAccountNumber,
          bankAccountMasked,
          submittedAt: new Date(),
          reviewedAt: null,
          reviewedByUserId: null,
          rejectionReason: null,
          reviewNotes: null,
        },
      });

      await tx.riderDocument.deleteMany({
        where: { applicationId: app.id },
      });

      for (const doc of verifiedDocs) {
        await tx.riderDocument.create({
          data: {
            applicationId: app.id,
            ...doc,
          },
        });
      }

      return tx.riderKycApplication.findUniqueOrThrow({
        where: { id: app.id },
        include: {
          riderProfile: {
            include: { user: { select: { email: true } } },
          },
          documents: true,
        },
      });
    });

    return serializeKycApplication(saved);
  }

  async getMyApplication(userId: string): Promise<RiderKycApplicationResponseDto | null> {
    const rider = await prisma.riderProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { email: true } },
        kycApplication: {
          include: {
            documents: true,
            riderProfile: {
              include: { user: { select: { email: true } } },
            },
          },
        },
      },
    });

    if (!rider) {
      throw new ForbiddenError("Rider profile not found for this user");
    }

    if (!rider.kycApplication) {
      return null;
    }

    return serializeKycApplication(rider.kycApplication);
  }

  async listApplications(
    query: ListRiderKycApplicationsQueryDto
  ): Promise<PaginatedRiderKycApplicationsDto> {
    const where = query.status ? { status: query.status } : {};

    const [total, apps] = await Promise.all([
      prisma.riderKycApplication.count({ where }),
      prisma.riderKycApplication.findMany({
        where,
        include: {
          riderProfile: {
            include: { user: { select: { email: true } } },
          },
          documents: true,
        },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { submittedAt: "desc" },
      }),
    ]);

    return {
      items: apps.map(serializeKycApplication),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit) || 1,
    };
  }

  async getApplicationById(applicationId: string): Promise<RiderKycApplicationResponseDto> {
    const app = await prisma.riderKycApplication.findUnique({
      where: { id: applicationId },
      include: {
        riderProfile: {
          include: { user: { select: { email: true } } },
        },
        documents: true,
      },
    });

    if (!app) {
      throw new NotFoundError("Rider KYC application not found");
    }

    return serializeKycApplication(app);
  }

  async approveApplication(
    adminUserId: string,
    applicationId: string,
    notes?: string
  ): Promise<RiderKycApplicationResponseDto> {
    const app = await prisma.riderKycApplication.findUnique({
      where: { id: applicationId },
      include: {
        riderProfile: {
          include: { user: { select: { email: true } } },
        },
        documents: true,
      },
    });

    if (!app) {
      throw new NotFoundError("Rider KYC application not found");
    }

    if (app.status === "APPROVED") {
      throw new BadRequestError("Rider KYC application is already approved");
    }

    // Verify all mandatory KYC artifacts exist before activating rider profile
    if (
      !app.operatingCity ||
      !app.vehicleType ||
      !app.encryptedGovernmentId ||
      !app.encryptedBankAccountNumber
    ) {
      throw new BadRequestError(
        "Application is incomplete: missing identity, vehicle, or payout details"
      );
    }

    const docTypes = new Set(app.documents.map((d) => d.documentType));
    if (!docTypes.has("GOVERNMENT_ID") || !docTypes.has("SELFIE")) {
      throw new BadRequestError(
        "Application cannot be approved without verified GOVERNMENT_ID and SELFIE documents"
      );
    }
    if (app.vehicleType !== "BICYCLE" && !docTypes.has("DRIVER_LICENSE")) {
      throw new BadRequestError(
        "Motorized vehicle applications require a verified DRIVER_LICENSE document"
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedApp = await tx.riderKycApplication.update({
        where: { id: applicationId },
        data: {
          status: "APPROVED",
          reviewedAt: new Date(),
          reviewedByUserId: adminUserId,
          rejectionReason: null,
          reviewNotes: notes ?? null,
        },
        include: {
          riderProfile: {
            include: { user: { select: { email: true } } },
          },
          documents: true,
        },
      });

      await tx.riderProfile.update({
        where: { id: app.riderProfileId },
        data: {
          status: "ACTIVE",
          operatingCity: app.operatingCity,
          vehicleType: app.vehicleType,
          vehiclePlateNumber: app.vehiclePlateNumber,
          isOnline: false,
          isAvailable: false,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: adminUserId,
          action: "APPROVE",
          entityType: "RIDER_KYC_APPLICATION",
          entityId: app.id,
          before: { applicationStatus: app.status, riderStatus: app.riderProfile.status },
          after: { applicationStatus: "APPROVED", riderStatus: "ACTIVE" },
          metadata: notes ? { notes } : {},
        },
      });

      await tx.notification.create({
        data: {
          userId: app.riderProfile.userId,
          type: "SYSTEM",
          title: "Rider Application Approved",
          message:
            "Your CHOVIA Rider verification has been approved. You can now go online and accept deliveries.",
        },
      });

      return tx.riderKycApplication.findUniqueOrThrow({
        where: { id: updatedApp.id },
        include: {
          riderProfile: {
            include: { user: { select: { email: true } } },
          },
          documents: true,
        },
      });
    });

    return serializeKycApplication(updated);
  }

  async rejectApplication(
    adminUserId: string,
    applicationId: string,
    reason: string,
    notes?: string
  ): Promise<RiderKycApplicationResponseDto> {
    const app = await prisma.riderKycApplication.findUnique({
      where: { id: applicationId },
      include: {
        riderProfile: {
          include: { user: { select: { email: true } } },
        },
        documents: true,
      },
    });

    if (!app) {
      throw new NotFoundError("Rider KYC application not found");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedApp = await tx.riderKycApplication.update({
        where: { id: applicationId },
        data: {
          status: "REJECTED",
          reviewedAt: new Date(),
          reviewedByUserId: adminUserId,
          rejectionReason: reason,
          reviewNotes: notes ?? null,
        },
      });

      await tx.riderProfile.update({
        where: { id: app.riderProfileId },
        data: {
          status: "PENDING",
          isOnline: false,
          isAvailable: false,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: adminUserId,
          action: "REJECT",
          entityType: "RIDER_KYC_APPLICATION",
          entityId: app.id,
          before: { applicationStatus: app.status, riderStatus: app.riderProfile.status },
          after: { applicationStatus: "REJECTED", riderStatus: "PENDING", reason },
          metadata: notes ? { notes } : {},
        },
      });

      await tx.notification.create({
        data: {
          userId: app.riderProfile.userId,
          type: "SYSTEM",
          title: "Rider Application Update",
          message: `Your rider verification was not approved: ${reason}. Please review and resubmit your application.`,
        },
      });

      return tx.riderKycApplication.findUniqueOrThrow({
        where: { id: updatedApp.id },
        include: {
          riderProfile: {
            include: { user: { select: { email: true } } },
          },
          documents: true,
        },
      });
    });

    return serializeKycApplication(updated);
  }
}

export const riderKycService = new RiderKycService();
