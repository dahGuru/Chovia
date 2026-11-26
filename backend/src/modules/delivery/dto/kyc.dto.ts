import { z } from "zod";

const STRICT_E164_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;

export const RIDER_VEHICLE_TYPES = ["MOTORCYCLE", "BICYCLE", "CAR"] as const;
export const GOVERNMENT_ID_TYPES = [
  "NIN",
  "DRIVERS_LICENSE",
  "VOTERS_CARD",
  "INTERNATIONAL_PASSPORT",
] as const;
export const RIDER_DOCUMENT_TYPES = [
  "GOVERNMENT_ID",
  "DRIVER_LICENSE",
  "VEHICLE_REGISTRATION",
  "SELFIE",
] as const;

export const submitRiderDocumentItemSchema = z
  .object({
    documentType: z.enum(RIDER_DOCUMENT_TYPES),
    publicId: z.string().min(1, "Document publicId is required").max(300).trim(),
  })
  .strict();

export const submitRiderKycRequestSchema = z
  .object({
    firstName: z.string().min(1, "First name is required").max(100).trim(),
    lastName: z.string().min(1, "Last name is required").max(100).trim(),
    phone: z
      .string()
      .trim()
      .regex(STRICT_E164_PHONE_REGEX, "Phone number must be a valid E.164 number"),
    operatingCity: z.string().min(2, "Operating city is required").max(100).trim(),
    homeAddress: z.string().min(5).max(255).trim().optional(),
    vehicleType: z.enum(RIDER_VEHICLE_TYPES),
    vehiclePlateNumber: z.string().min(3).max(30).trim().optional(),
    governmentIdType: z.enum(GOVERNMENT_ID_TYPES),
    governmentIdNumber: z
      .string()
      .min(6, "Government ID number must be at least 6 characters")
      .max(30)
      .trim(),
    bankName: z.string().min(2, "Bank name is required").max(100).trim(),
    bankCode: z.string().min(3).max(20).trim().optional(),
    accountHolderName: z.string().min(2, "Account holder name is required").max(120).trim(),
    bankAccountNumber: z
      .string()
      .regex(/^\d{10}$/, "Bank account number must be a valid 10-digit NUBAN account number")
      .trim(),
    documents: z.array(submitRiderDocumentItemSchema).min(2, "At least GOVERNMENT_ID and SELFIE documents are required"),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.vehicleType !== "BICYCLE" && (!val.vehiclePlateNumber || val.vehiclePlateNumber.length < 3)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["vehiclePlateNumber"],
        message: "Vehicle plate number is required for motorcycles and cars",
      });
    }

    const docTypes = new Set(val.documents.map((d) => d.documentType));
    if (docTypes.size !== val.documents.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["documents"],
        message: "Duplicate document types are not permitted in a single submission",
      });
    }
    if (!docTypes.has("GOVERNMENT_ID")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["documents"],
        message: "A government ID document is required",
      });
    }
    if (!docTypes.has("SELFIE")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["documents"],
        message: "A live selfie verification document is required",
      });
    }
    if (val.vehicleType !== "BICYCLE" && !docTypes.has("DRIVER_LICENSE")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["documents"],
        message: "A driver's license document is required for motorized vehicles",
      });
    }
  });

export type SubmitRiderKycRequestDto = z.infer<typeof submitRiderKycRequestSchema>;

export const riderDocumentResponseSchema = z
  .object({
    id: z.string().uuid(),
    documentType: z.enum(RIDER_DOCUMENT_TYPES),
    publicId: z.string(),
    resourceType: z.string(),
    deliveryType: z.string(),
    format: z.string().nullable().optional(),
    bytes: z.number().int().nullable().optional(),
    signedAccessUrl: z.string(),
    verifiedAt: z.string().nullable().optional(),
  })
  .strict();

export type RiderDocumentResponseDto = z.infer<typeof riderDocumentResponseSchema>;

export const riderKycApplicationResponseSchema = z
  .object({
    id: z.string().uuid(),
    riderProfileId: z.string().uuid(),
    userId: z.string().uuid().optional(),
    email: z.string().email().optional(),
    status: z.enum(["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"]),
    riderStatus: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "DEACTIVATED"]),
    firstName: z.string(),
    lastName: z.string(),
    phone: z.string(),
    operatingCity: z.string(),
    homeAddress: z.string().nullable().optional(),
    vehicleType: z.string(),
    vehiclePlateNumber: z.string().nullable().optional(),
    governmentIdType: z.string(),
    governmentIdMasked: z.string(),
    bankName: z.string(),
    bankCode: z.string().nullable().optional(),
    accountHolderName: z.string(),
    bankAccountMasked: z.string(),
    submittedAt: z.string(),
    reviewedAt: z.string().nullable().optional(),
    rejectionReason: z.string().nullable().optional(),
    reviewNotes: z.string().nullable().optional(),
    documents: z.array(riderDocumentResponseSchema),
  })
  .strict();

export type RiderKycApplicationResponseDto = z.infer<typeof riderKycApplicationResponseSchema>;

export const listRiderKycApplicationsQuerySchema = z.object({
  status: z.enum(["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type ListRiderKycApplicationsQueryDto = z.infer<typeof listRiderKycApplicationsQuerySchema>;

export const adminApproveKycSchema = z
  .object({
    notes: z.string().max(500).trim().optional(),
  })
  .strict();

export const adminRejectKycSchema = z
  .object({
    reason: z.string().min(3, "Rejection reason is required").max(500).trim(),
    notes: z.string().max(500).trim().optional(),
  })
  .strict();

export const paginatedRiderKycApplicationsSchema = z
  .object({
    items: z.array(riderKycApplicationResponseSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();

export type PaginatedRiderKycApplicationsDto = z.infer<typeof paginatedRiderKycApplicationsSchema>;
