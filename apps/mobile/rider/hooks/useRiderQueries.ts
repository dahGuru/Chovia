import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { riderAccountService, type UpdateUserRequestDto } from "../services/riderAccountService";
import {
  riderDeliveryService,
  type SubmitRiderKycRequestDto,
  type UpdateRiderStatusDto,
} from "../services/riderDeliveryService";
import { useAuthStore } from "../store/useAuthStore";
import { useRiderStore } from "../store/useRiderStore";

export const riderQueryKeys = {
  riderProfile: ["rider", "session-profile"] as const,
  kyc: ["rider", "kyc"] as const,
  availableDeliveries: ["rider", "available-deliveries"] as const,
  activeDelivery: ["rider", "active-delivery"] as const,
  deliveryHistory: (page = 1, status?: string) =>
    ["rider", "delivery-history", page, status ?? "all"] as const,
  tracking: (orderId: string) => ["rider", "tracking", orderId] as const,
  notifications: ["rider", "notifications"] as const,
  profile: ["rider", "profile"] as const,
};

export function useRiderSessionProfile() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const syncFromServerProfile = useRiderStore((s) => s.syncFromServerProfile);

  const query = useQuery({
    queryKey: riderQueryKeys.riderProfile,
    queryFn: () => riderDeliveryService.getMyProfile(),
    enabled: isAuthenticated,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (query.data) {
      syncFromServerProfile(query.data);
    }
  }, [query.data, syncFromServerProfile]);

  return query;
}

export function useActiveDelivery() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setActiveDelivery = useRiderStore((s) => s.setActiveDelivery);

  const query = useQuery({
    queryKey: riderQueryKeys.activeDelivery,
    queryFn: () => riderDeliveryService.getActiveDelivery(),
    enabled: isAuthenticated,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (query.data !== undefined) {
      setActiveDelivery(query.data);
    }
  }, [query.data, setActiveDelivery]);

  return query;
}

export function useRiderDeliveryHistory(options?: {
  status?: "ASSIGNED" | "OUT_FOR_DELIVERY" | "DELIVERED";
  page?: number;
  limit?: number;
}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const page = options?.page ?? 1;
  return useQuery({
    queryKey: riderQueryKeys.deliveryHistory(page, options?.status),
    queryFn: () => riderDeliveryService.getDeliveryHistory(options),
    enabled: isAuthenticated,
  });
}

export function useRiderKycApplication() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: riderQueryKeys.kyc,
    queryFn: () => riderDeliveryService.getMyKyc(),
    enabled: isAuthenticated,
  });
}

export function useSubmitRiderKyc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SubmitRiderKycRequestDto) => riderDeliveryService.submitKyc(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: riderQueryKeys.kyc });
      void qc.invalidateQueries({ queryKey: riderQueryKeys.riderProfile });
    },
  });
}

export function useAvailableDeliveries(enabled: boolean) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: riderQueryKeys.availableDeliveries,
    queryFn: () => riderDeliveryService.getAvailableDeliveries(),
    enabled: isAuthenticated && enabled,
    refetchInterval: enabled ? 10_000 : false,
  });
}

export function useDeliveryTracking(orderId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: riderQueryKeys.tracking(orderId),
    queryFn: () => riderDeliveryService.trackDelivery(orderId),
    enabled: isAuthenticated && Boolean(orderId),
    refetchInterval: 15_000,
  });
}

export function useUpdateRiderStatus() {
  const setShiftOnline = useRiderStore((s) => s.setShiftOnline);
  const setLastKnownCoordinates = useRiderStore((s) => s.setLastKnownCoordinates);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateRiderStatusDto) => riderDeliveryService.updateStatus(payload),
    onSuccess: (data) => {
      setShiftOnline(data.isOnline);
      if (typeof data.lastLatitude === "number" && typeof data.lastLongitude === "number") {
        setLastKnownCoordinates({ latitude: data.lastLatitude, longitude: data.lastLongitude });
      }
      void qc.invalidateQueries({ queryKey: riderQueryKeys.riderProfile });
      void qc.invalidateQueries({ queryKey: riderQueryKeys.availableDeliveries });
    },
  });
}

export function useUpdateRiderLocation() {
  const setLastKnownCoordinates = useRiderStore((s) => s.setLastKnownCoordinates);
  return useMutation({
    mutationFn: ({ latitude, longitude }: { latitude: number; longitude: number }) =>
      riderDeliveryService.updateLocation(latitude, longitude),
    onSuccess: (data) => {
      if (typeof data.lastLatitude === "number" && typeof data.lastLongitude === "number") {
        setLastKnownCoordinates({ latitude: data.lastLatitude, longitude: data.lastLongitude });
      }
    },
  });
}

export function useAcceptDelivery() {
  const setActiveDelivery = useRiderStore((s) => s.setActiveDelivery);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deliveryId: string) => riderDeliveryService.acceptDelivery(deliveryId),
    onSuccess: (delivery) => {
      // Authoritative backend confirmation before updating client state
      setActiveDelivery(delivery);
      void qc.invalidateQueries({ queryKey: riderQueryKeys.riderProfile });
      void qc.invalidateQueries({ queryKey: riderQueryKeys.activeDelivery });
      void qc.invalidateQueries({ queryKey: riderQueryKeys.availableDeliveries });
    },
  });
}

export function usePickupDelivery() {
  const setActiveDelivery = useRiderStore((s) => s.setActiveDelivery);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deliveryId: string) => riderDeliveryService.pickupDelivery(deliveryId),
    onSuccess: (delivery) => {
      setActiveDelivery(delivery);
      void qc.invalidateQueries({ queryKey: riderQueryKeys.activeDelivery });
    },
  });
}

export function useCompleteDelivery() {
  const recordCompletedDelivery = useRiderStore((s) => s.recordCompletedDelivery);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deliveryId: string) => riderDeliveryService.completeDelivery(deliveryId),
    onSuccess: (delivery) => {
      recordCompletedDelivery(delivery);
      void qc.invalidateQueries({ queryKey: riderQueryKeys.riderProfile });
      void qc.invalidateQueries({ queryKey: riderQueryKeys.activeDelivery });
      void qc.invalidateQueries({ queryKey: riderQueryKeys.availableDeliveries });
      void qc.invalidateQueries({ queryKey: ["rider", "delivery-history"] });
    },
  });
}

export function useRiderNotifications() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: riderQueryKeys.notifications,
    queryFn: () => riderAccountService.listNotifications(),
    enabled: isAuthenticated,
  });
}

export function useMarkRiderNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => riderAccountService.markNotificationRead(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: riderQueryKeys.notifications });
    },
  });
}

export function useMarkAllRiderNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => riderAccountService.markAllNotificationsRead(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: riderQueryKeys.notifications });
    },
  });
}

export function useUpdateRiderProfile() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateUserRequestDto) => riderAccountService.updateProfile(payload),
    onSuccess: () => {
      void hydrate();
      void qc.invalidateQueries({ queryKey: riderQueryKeys.riderProfile });
    },
  });
}
