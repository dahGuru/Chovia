import React, { useEffect, useMemo, useState } from "react";
import { Alert, RefreshControl, ScrollView, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Button } from "../../components/Button";
import { BellIcon, CheckIcon, ClockIcon, PinIcon } from "../../components/Icons";
import { EmptyState, ErrorState, LoadingView } from "../../components/StateViews";
import {
  useAcceptDelivery,
  useActiveDelivery,
  useAvailableDeliveries,
  useRiderNotifications,
  useRiderSessionProfile,
  useUpdateRiderLocation,
  useUpdateRiderStatus,
} from "../../hooks/useRiderQueries";
import { ApiClientError } from "../../services/api";
import { LocationAccessError, locationService } from "../../services/locationService";
import { useAuthStore } from "../../store/useAuthStore";
import { useRiderStore } from "../../store/useRiderStore";
import { COLORS } from "../../utils/theme";

const LOCATION_SYNC_INTERVAL_MS = 45_000;

export default function RiderHomeScreen() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const isShiftOnline = useRiderStore((s) => s.isShiftOnline);
  const activeDelivery = useRiderStore((s) => s.activeDelivery);
  const lastKnownCoordinates = useRiderStore((s) => s.lastKnownCoordinates);
  const declinedDeliveryIds = useRiderStore((s) => s.declinedDeliveryIds);
  const declineDeliveryId = useRiderStore((s) => s.declineDeliveryId);

  const [isAcquiringLocation, setIsAcquiringLocation] = useState(false);

  const {
    data: riderProfile,
    isLoading: isProfileLoading,
    refetch: refetchProfile,
  } = useRiderSessionProfile();
  const { refetch: refetchActiveDelivery } = useActiveDelivery();

  const updateStatus = useUpdateRiderStatus();
  const updateLocation = useUpdateRiderLocation();
  const acceptDelivery = useAcceptDelivery();
  const { data: notifications } = useRiderNotifications();

  const isRiderApproved = riderProfile?.status === "ACTIVE";

  const {
    data: availableDeliveries,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useAvailableDeliveries(Boolean(isRiderApproved && isShiftOnline && !activeDelivery));

  // Periodic foreground GPS location sync while online & approved
  useEffect(() => {
    if (!isAuthenticated || !isRiderApproved || !isShiftOnline) {
      return;
    }

    let cancelled = false;
    const syncCoordinates = async () => {
      try {
        const coords = await locationService.getCurrentCoordinates();
        if (!cancelled) {
          updateLocation.mutate(coords);
        }
      } catch {
        // Non-fatal periodic background refresh failure; user remains notified on explicit toggle
      }
    };

    const intervalId = setInterval(() => {
      void syncCoordinates();
    }, LOCATION_SYNC_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [isAuthenticated, isRiderApproved, isShiftOnline, updateLocation]);

  const unreadCount = useMemo(
    () => (notifications ? notifications.filter((n) => !n.isRead).length : 0),
    [notifications]
  );

  const visibleOffers = useMemo(() => {
    const list = availableDeliveries ?? [];
    return list.filter((d) => !declinedDeliveryIds.includes(d.id));
  }, [availableDeliveries, declinedDeliveryIds]);

  const handleToggleShift = async () => {
    if (isShiftOnline) {
      try {
        await updateStatus.mutateAsync({ isOnline: false });
      } catch (err) {
        Alert.alert(
          "Unable to go offline",
          err instanceof ApiClientError ? err.message : "Could not update shift status."
        );
      }
      return;
    }

    if (!isRiderApproved) {
      Alert.alert(
        "Approval required",
        riderProfile?.kycStatus === "NOT_SUBMITTED"
          ? "Please submit your KYC application before going online."
          : "Your rider account must be approved before you can go online."
      );
      return;
    }

    setIsAcquiringLocation(true);
    try {
      const coords = await locationService.getCurrentCoordinates();
      await updateStatus.mutateAsync({
        isOnline: true,
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
    } catch (err) {
      if (err instanceof LocationAccessError) {
        Alert.alert("Location required", err.message);
      } else {
        Alert.alert(
          "Status update failed",
          err instanceof ApiClientError ? err.message : "Could not go online. Please try again."
        );
      }
    } finally {
      setIsAcquiringLocation(false);
    }
  };

  const handleAcceptOffer = async (deliveryId: string) => {
    try {
      const delivery = await acceptDelivery.mutateAsync(deliveryId);
      router.push(`/deliveries/${delivery.id}`);
    } catch (err) {
      Alert.alert(
        "Unable to accept delivery",
        err instanceof ApiClientError
          ? err.message
          : "This delivery may have been claimed or your rider eligibility is not active."
      );
      void refetch();
    }
  };

  if (!isAuthenticated || !user) {
    return (
      <SafeAreaView className="flex-1 bg-chovia-background" edges={["top"]}>
        <View className="flex-1 justify-center px-5">
          <EmptyState
            title="Rider Session Required"
            description="Log in with your CHOVIA Rider account to go online and accept deliveries."
            actionLabel="Log in"
            onAction={() => router.replace("/(auth)/login")}
          />
        </View>
      </SafeAreaView>
    );
  }

  const firstName = riderProfile?.firstName || user.firstName || "Rider";

  return (
    <SafeAreaView className="flex-1 bg-chovia-background" edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      {/* App Header */}
      <View className="h-[56px] flex-row items-center justify-between px-5">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.push("/profile/notifications")}
            className="relative h-9 w-9 items-center justify-center rounded-full bg-chovia-card"
            accessibilityLabel="Notifications"
          >
            <BellIcon size={18} color={COLORS.deep} />
            {unreadCount > 0 && (
              <View className="absolute right-2 top-2 h-2 w-2 rounded-full bg-chovia-error" />
            )}
          </TouchableOpacity>
          <Text className="font-manrope-semibold text-[16px] text-chovia-deep">
            Hi, {firstName}
          </Text>
        </View>

        <View
          className={`rounded-full px-3 py-1 ${
            isShiftOnline ? "bg-emerald-100" : "bg-slate-200"
          }`}
        >
          <Text
            className={`font-manrope-semibold text-[11px] ${
              isShiftOnline ? "text-chovia-green" : "text-chovia-muted"
            }`}
          >
            {isShiftOnline ? "ONLINE" : "OFFLINE"}
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerClassName="pb-8 pt-2 gap-4"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              void refetchProfile();
              void refetchActiveDelivery();
              if (isRiderApproved && isShiftOnline) {
                void refetch();
              }
            }}
            tintColor={COLORS.primary}
          />
        }
      >
        {isProfileLoading && !riderProfile ? (
          <LoadingView label="Restoring rider session..." />
        ) : riderProfile && !isRiderApproved ? (
          <View className="gap-3 rounded-[16px] border border-amber-300 bg-amber-50 p-4">
            <Text className="font-manrope-bold text-[15px] text-amber-900">
              {riderProfile.kycStatus === "NOT_SUBMITTED"
                ? "Complete KYC Verification"
                : riderProfile.kycStatus === "REJECTED"
                  ? "Application Requires Updates"
                  : `Profile Status: ${riderProfile.status} (${riderProfile.kycStatus.replace("_", " ")})`}
            </Text>
            <Text className="font-manrope text-[13px] leading-[19px] text-amber-800">
              {riderProfile.kycStatus === "NOT_SUBMITTED"
                ? "Submit your personal, vehicle, bank payout, and identity documents to activate deliveries."
                : riderProfile.kycRejectionReason
                  ? `Rejection reason: ${riderProfile.kycRejectionReason}`
                  : "Your account cannot go online or accept deliveries until KYC review is approved."}
            </Text>
            <Button
              label={
                riderProfile.kycStatus === "NOT_SUBMITTED"
                  ? "Start KYC Application"
                  : "View Application Status"
              }
              onPress={() =>
                router.push(
                  riderProfile.kycStatus === "NOT_SUBMITTED"
                    ? "/(auth)/kyc"
                    : "/(auth)/application-status"
                )
              }
            />
          </View>
        ) : null}

        {/* Shift Card */}
        <View
          className={`gap-2 rounded-[16px] p-4 ${
            isShiftOnline ? "bg-chovia-green" : "bg-chovia-card"
          }`}
        >
          <View className="flex-row items-center gap-2.5">
            <CheckIcon size={18} color={isShiftOnline ? COLORS.white : COLORS.muted} />
            <Text
              className={`font-manrope-semibold text-[16px] ${
                isShiftOnline ? "text-white" : "text-chovia-deep"
              }`}
            >
              {isShiftOnline ? "You’re online" : "You’re offline"}
            </Text>
          </View>
          <Text
            className={`font-manrope text-[13px] ${
              isShiftOnline ? "text-white/85" : "text-chovia-muted"
            }`}
          >
            {isShiftOnline
              ? "GPS active • Looking for nearby deliveries ready for pickup..."
              : isRiderApproved
                ? "Go online to share live GPS coordinates and receive delivery requests."
                : "Available once your KYC verification is approved."}
          </Text>
          {isShiftOnline && lastKnownCoordinates && (
            <Text className="font-manrope text-[11px] text-white/80">
              Location synced: {lastKnownCoordinates.latitude.toFixed(4)},{" "}
              {lastKnownCoordinates.longitude.toFixed(4)}
            </Text>
          )}
          <View className="mt-2">
            <Button
              label={isShiftOnline ? "Go Offline" : "Go Online"}
              variant={isShiftOnline ? "secondary" : "primary"}
              disabled={!isShiftOnline && !isRiderApproved}
              onPress={() => void handleToggleShift()}
              loading={updateStatus.isPending || isAcquiringLocation}
            />
          </View>
        </View>

        {/* Active Delivery Resume Banner */}
        {activeDelivery && (
          <View className="gap-3 rounded-[16px] border border-chovia-green bg-emerald-50 p-4">
            <View className="flex-row items-center justify-between">
              <Text className="font-manrope-bold text-[15px] text-chovia-deep">
                Active Delivery • #{activeDelivery.orderNumber}
              </Text>
              <Text className="font-manrope-bold text-[14px] text-chovia-green">
                {activeDelivery.riderEarningsFormatted}
              </Text>
            </View>
            <Text className="font-manrope text-[13px] text-chovia-muted">
              {activeDelivery.restaurantName} → {activeDelivery.deliveryAddressText}
            </Text>
            <Button
              label="Open Active Delivery"
              onPress={() => router.push(`/deliveries/${activeDelivery.id}`)}
            />
          </View>
        )}

        {/* Available Delivery Requests */}
        {isRiderApproved && isShiftOnline && !activeDelivery && (
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="font-manrope-semibold text-[16px] text-chovia-deep">
                Available Requests
              </Text>
              <TouchableOpacity onPress={() => void refetch()}>
                <Text className="font-manrope-semibold text-[13px] text-chovia-green">
                  Refresh
                </Text>
              </TouchableOpacity>
            </View>

            {isLoading ? (
              <LoadingView label="Checking available deliveries..." />
            ) : isError ? (
              <ErrorState
                message={
                  error instanceof ApiClientError
                    ? error.message
                    : "Unable to load available deliveries."
                }
                onRetry={() => void refetch()}
              />
            ) : visibleOffers.length === 0 ? (
              <EmptyState
                title="No deliveries ready yet"
                description="Stay online — new ready-for-pickup orders will appear here automatically."
              />
            ) : (
              visibleOffers.map((offer) => (
                <View
                  key={offer.id}
                  className="gap-3 rounded-[16px] border border-chovia-border bg-chovia-card p-4"
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-3">
                      <Text className="font-manrope-semibold text-[16px] text-chovia-deep">
                        {offer.restaurantName}
                      </Text>
                      <Text className="mt-0.5 font-manrope text-[12px] text-chovia-subtle">
                        Order #{offer.orderNumber}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="font-manrope-bold text-[18px] text-chovia-green">
                        {offer.riderEarningsFormatted}
                      </Text>
                      {offer.distanceKm !== null && offer.distanceKm !== undefined && (
                        <Text className="font-manrope text-[11px] text-chovia-muted">
                          {offer.distanceKm.toFixed(1)} km
                        </Text>
                      )}
                    </View>
                  </View>

                  <View className="gap-1.5 border-t border-chovia-border pt-2.5">
                    <View className="flex-row items-center gap-2">
                      <PinIcon size={15} color={COLORS.primary} />
                      <Text className="flex-1 font-manrope text-[12px] text-chovia-muted">
                        Pickup: {offer.restaurantAddress}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <ClockIcon size={15} color={COLORS.gold} />
                      <Text className="flex-1 font-manrope text-[12px] text-chovia-muted">
                        Dropoff: {offer.deliveryAddressText}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row gap-2.5">
                    <View className="flex-1">
                      <Button
                        label="Decline"
                        variant="secondary"
                        onPress={() => declineDeliveryId(offer.id)}
                      />
                    </View>
                    <View className="flex-1">
                      <Button
                        label="Accept"
                        onPress={() => void handleAcceptOffer(offer.id)}
                        loading={acceptDelivery.isPending}
                      />
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
