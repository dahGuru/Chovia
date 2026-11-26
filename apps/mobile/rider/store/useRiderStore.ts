import { create } from "zustand";
import type {
  DeliveryResponseDto,
  RiderKycStatus,
  RiderProfileStatus,
  RiderSessionProfileResponseDto,
} from "../services/riderDeliveryService";

export interface RiderKycDraft {
  firstName: string;
  lastName: string;
  phone: string;
  operatingCity: string;
  homeAddress: string;
  vehicleType: "MOTORCYCLE" | "BICYCLE" | "CAR";
  vehiclePlateNumber: string;
  governmentIdType: "NIN" | "DRIVERS_LICENSE" | "VOTERS_CARD" | "INTERNATIONAL_PASSPORT";
  governmentIdNumber: string;
  bankName: string;
  accountHolderName: string;
  bankAccountNumber: string;
}

interface RiderState {
  isShiftOnline: boolean;
  riderStatus: RiderProfileStatus | null;
  kycStatus: RiderKycStatus | null;
  lastKnownCoordinates: { latitude: number; longitude: number } | null;
  activeDelivery: DeliveryResponseDto | null;
  sessionCompleted: DeliveryResponseDto[];
  declinedDeliveryIds: string[];
  kycDraft: RiderKycDraft;
  syncFromServerProfile: (profile: RiderSessionProfileResponseDto) => void;
  setShiftOnline: (online: boolean) => void;
  setLastKnownCoordinates: (coords: { latitude: number; longitude: number } | null) => void;
  setActiveDelivery: (delivery: DeliveryResponseDto | null) => void;
  recordCompletedDelivery: (delivery: DeliveryResponseDto) => void;
  declineDeliveryId: (id: string) => void;
  updateKycDraft: (patch: Partial<RiderKycDraft>) => void;
  resetSessionState: () => void;
}

const INITIAL_KYC_DRAFT: RiderKycDraft = {
  firstName: "",
  lastName: "",
  phone: "",
  operatingCity: "Ekpoma",
  homeAddress: "",
  vehicleType: "MOTORCYCLE",
  vehiclePlateNumber: "",
  governmentIdType: "NIN",
  governmentIdNumber: "",
  bankName: "",
  accountHolderName: "",
  bankAccountNumber: "",
};

export const useRiderStore = create<RiderState>((set) => ({
  isShiftOnline: false,
  riderStatus: null,
  kycStatus: null,
  lastKnownCoordinates: null,
  activeDelivery: null,
  sessionCompleted: [],
  declinedDeliveryIds: [],
  kycDraft: INITIAL_KYC_DRAFT,

  syncFromServerProfile: (profile) =>
    set({
      isShiftOnline: profile.isOnline,
      riderStatus: profile.status,
      kycStatus: profile.kycStatus,
      lastKnownCoordinates:
        typeof profile.lastLatitude === "number" && typeof profile.lastLongitude === "number"
          ? { latitude: profile.lastLatitude, longitude: profile.lastLongitude }
          : null,
    }),

  setShiftOnline: (isShiftOnline) => set({ isShiftOnline }),
  setLastKnownCoordinates: (lastKnownCoordinates) => set({ lastKnownCoordinates }),
  setActiveDelivery: (activeDelivery) => set({ activeDelivery }),
  recordCompletedDelivery: (delivery) =>
    set((state) => ({
      activeDelivery: null,
      sessionCompleted: [
        delivery,
        ...state.sessionCompleted.filter((d) => d.id !== delivery.id),
      ],
    })),
  declineDeliveryId: (id) =>
    set((state) => ({
      declinedDeliveryIds: state.declinedDeliveryIds.includes(id)
        ? state.declinedDeliveryIds
        : [...state.declinedDeliveryIds, id],
    })),
  updateKycDraft: (patch) =>
    set((state) => ({
      kycDraft: { ...state.kycDraft, ...patch },
    })),
  resetSessionState: () =>
    set({
      isShiftOnline: false,
      riderStatus: null,
      kycStatus: null,
      lastKnownCoordinates: null,
      activeDelivery: null,
      sessionCompleted: [],
      declinedDeliveryIds: [],
      kycDraft: INITIAL_KYC_DRAFT,
    }),
}));
