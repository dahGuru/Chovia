import { api } from "./api";

export type RiderProfileStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
export type RiderKycStatus = "NOT_SUBMITTED" | "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
export type RiderVehicleType = "MOTORCYCLE" | "BICYCLE" | "CAR";
export type GovernmentIdType =
  | "NIN"
  | "DRIVERS_LICENSE"
  | "VOTERS_CARD"
  | "INTERNATIONAL_PASSPORT";
export type RiderDocumentType =
  | "GOVERNMENT_ID"
  | "DRIVER_LICENSE"
  | "VEHICLE_REGISTRATION"
  | "SELFIE";

export interface UpdateRiderStatusDto {
  isOnline: boolean;
  latitude?: number | undefined;
  longitude?: number | undefined;
}

export interface RiderStatusResponseDto {
  status: RiderProfileStatus;
  isOnline: boolean;
  isAvailable: boolean;
  lastLatitude?: number | null;
  lastLongitude?: number | null;
  lastLocationUpdatedAt?: string | null;
}

export interface RiderSessionProfileResponseDto {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  status: RiderProfileStatus;
  isOnline: boolean;
  isAvailable: boolean;
  operatingCity?: string | null;
  vehicleType?: string | null;
  vehiclePlateNumber?: string | null;
  lastLatitude?: number | null;
  lastLongitude?: number | null;
  lastLocationUpdatedAt?: string | null;
  kycStatus: RiderKycStatus;
  kycRejectionReason?: string | null;
  activeDeliveryCount: number;
}

export interface RiderDocumentResponseDto {
  id: string;
  documentType: RiderDocumentType;
  publicId: string;
  resourceType: string;
  deliveryType: string;
  format?: string | null;
  bytes?: number | null;
  signedAccessUrl: string;
  verifiedAt?: string | null;
}

export interface RiderKycApplicationResponseDto {
  id: string;
  riderProfileId: string;
  userId?: string;
  email?: string;
  status: Exclude<RiderKycStatus, "NOT_SUBMITTED">;
  riderStatus: RiderProfileStatus;
  firstName: string;
  lastName: string;
  phone: string;
  operatingCity: string;
  homeAddress?: string | null;
  vehicleType: string;
  vehiclePlateNumber?: string | null;
  governmentIdType: string;
  governmentIdMasked: string;
  bankName: string;
  bankCode?: string | null;
  accountHolderName: string;
  bankAccountMasked: string;
  submittedAt: string;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  reviewNotes?: string | null;
  documents: RiderDocumentResponseDto[];
}

export interface SubmitRiderKycRequestDto {
  firstName: string;
  lastName: string;
  phone: string;
  operatingCity: string;
  homeAddress?: string | undefined;
  vehicleType: RiderVehicleType;
  vehiclePlateNumber?: string | undefined;
  governmentIdType: GovernmentIdType;
  governmentIdNumber: string;
  bankName: string;
  bankCode?: string | undefined;
  accountHolderName: string;
  bankAccountNumber: string;
  documents: Array<{
    documentType: RiderDocumentType;
    publicId: string;
  }>;
}

export interface UploadDocumentResultDto {
  publicId: string;
  secureUrl: string;
  deliveryType?: "upload" | "authenticated";
  format?: string;
  bytes?: number;
  resourceType?: string;
}

export interface DeliveryResponseDto {
  id: string;
  orderId: string;
  orderNumber: string;
  restaurantName: string;
  restaurantAddress: string;
  deliveryAddressText: string;
  distanceKm?: number | null;
  riderEarningsMinor: number;
  riderEarningsFormatted: string;
  status: string;
  assignedAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
}

export interface PaginatedRiderDeliveryHistoryDto {
  items: DeliveryResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  totalEarningsMinor: number;
  totalEarningsFormatted: string;
}

export interface DeliveryTrackingResponseDto {
  orderId: string;
  orderNumber: string;
  deliveryStatus: string;
  restaurant: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  destination: {
    addressText: string;
    latitude: number;
    longitude: number;
  };
  rider?: {
    name: string;
    phone: string;
    vehicleType?: string | null;
    vehiclePlateNumber?: string | null;
  } | null;
  assignedAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
}

export const riderDeliveryService = {
  async getMyProfile(): Promise<RiderSessionProfileResponseDto> {
    const { data } = await api.get<RiderSessionProfileResponseDto>("/riders/me");
    return data;
  },

  async getMyKyc(): Promise<RiderKycApplicationResponseDto | null> {
    const { data } = await api.get<RiderKycApplicationResponseDto | null>("/riders/kyc");
    return data;
  },

  async submitKyc(payload: SubmitRiderKycRequestDto): Promise<RiderKycApplicationResponseDto> {
    const { data } = await api.post<RiderKycApplicationResponseDto>("/riders/kyc", payload);
    return data;
  },

  async uploadKycDocument(payload: {
    fileDataUri: string;
    mimeType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
    fileSizeBytes?: number | undefined;
    customPublicId?: string | undefined;
  }): Promise<UploadDocumentResultDto> {
    const { data } = await api.post<UploadDocumentResultDto>("/users/upload-image", {
      file: payload.fileDataUri,
      folder: "documents",
      mimeType: payload.mimeType,
      ...(payload.fileSizeBytes ? { fileSizeBytes: payload.fileSizeBytes } : {}),
      ...(payload.customPublicId ? { customPublicId: payload.customPublicId } : {}),
    });
    return data;
  },

  async updateStatus(payload: UpdateRiderStatusDto): Promise<RiderStatusResponseDto> {
    const { data } = await api.patch<RiderStatusResponseDto>("/riders/status", payload);
    return data;
  },

  async updateLocation(latitude: number, longitude: number): Promise<RiderStatusResponseDto> {
    const { data } = await api.patch<RiderStatusResponseDto>("/riders/location", {
      latitude,
      longitude,
    });
    return data;
  },

  async getAvailableDeliveries(): Promise<DeliveryResponseDto[]> {
    const { data } = await api.get<DeliveryResponseDto[]>("/riders/deliveries/available");
    return data;
  },

  async getActiveDelivery(): Promise<DeliveryResponseDto | null> {
    const { data } = await api.get<DeliveryResponseDto | null>("/riders/deliveries/active");
    return data;
  },

  async getDeliveryHistory(query?: {
    status?: "ASSIGNED" | "OUT_FOR_DELIVERY" | "DELIVERED";
    page?: number;
    limit?: number;
  }): Promise<PaginatedRiderDeliveryHistoryDto> {
    const { data } = await api.get<PaginatedRiderDeliveryHistoryDto>(
      "/riders/deliveries/history",
      { params: query }
    );
    return data;
  },

  async acceptDelivery(deliveryId: string): Promise<DeliveryResponseDto> {
    const { data } = await api.post<DeliveryResponseDto>(
      `/riders/deliveries/${deliveryId}/accept`
    );
    return data;
  },

  async pickupDelivery(deliveryId: string): Promise<DeliveryResponseDto> {
    const { data } = await api.post<DeliveryResponseDto>(
      `/riders/deliveries/${deliveryId}/pickup`
    );
    return data;
  },

  async completeDelivery(deliveryId: string): Promise<DeliveryResponseDto> {
    const { data } = await api.post<DeliveryResponseDto>(
      `/riders/deliveries/${deliveryId}/complete`
    );
    return data;
  },

  async trackDelivery(orderId: string): Promise<DeliveryTrackingResponseDto> {
    const { data } = await api.get<DeliveryTrackingResponseDto>(`/deliveries/${orderId}/track`);
    return data;
  },
};
