import React from "react";
import { Alert, Linking, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Button } from "../../components/Button";
import { CheckIcon, PinIcon } from "../../components/Icons";
import { RiderHeader } from "../../components/RiderHeader";
import { EmptyState, LoadingView } from "../../components/StateViews";
import {
  useActiveDelivery,
  useCompleteDelivery,
  useDeliveryTracking,
  usePickupDelivery,
  useRiderDeliveryHistory,
} from "../../hooks/useRiderQueries";
import { ApiClientError } from "../../services/api";
import { useRiderStore } from "../../store/useRiderStore";
import { getDeliveryStatusMeta } from "../../utils/formatters";
import { COLORS } from "../../utils/theme";

export default function RiderActiveDeliveryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const deliveryId = typeof id === "string" ? id : "";

  const storeActiveDelivery = useRiderStore((s) => s.activeDelivery);
  const sessionCompleted = useRiderStore((s) => s.sessionCompleted);

  const { data: serverActiveDelivery } = useActiveDelivery();
  const { data: history } = useRiderDeliveryHistory({ page: 1, limit: 30 });

  const activeDelivery = serverActiveDelivery ?? storeActiveDelivery;
  const delivery =
    (activeDelivery?.id === deliveryId ? activeDelivery : null) ??
    sessionCompleted.find((d) => d.id === deliveryId) ??
    history?.items.find((d) => d.id === deliveryId) ??
    null;

  const { data: tracking, isLoading, refetch, isRefetching } = useDeliveryTracking(
    delivery?.orderId ?? ""
  );

  const pickupDelivery = usePickupDelivery();
  const completeDelivery = useCompleteDelivery();

  const handleConfirmPickup = async () => {
    if (!delivery) return;
    try {
      await pickupDelivery.mutateAsync(delivery.id);
      void refetch();
    } catch (err) {
      Alert.alert(
        "Pickup confirmation failed",
        err instanceof ApiClientError ? err.message : "Could not mark order as picked up."
      );
    }
  };

  const handleConfirmComplete = async () => {
    if (!delivery) return;
    try {
      await completeDelivery.mutateAsync(delivery.id);
    } catch (err) {
      Alert.alert(
        "Completion failed",
        err instanceof ApiClientError ? err.message : "Could not complete delivery."
      );
    }
  };

  const openExternalMaps = (lat?: number, lng?: number, label?: string) => {
    if (typeof lat !== "number" || typeof lng !== "number") {
      Alert.alert("Coordinates unavailable", "No map coordinates returned for this stop.");
      return;
    }
    const query = encodeURIComponent(label || `${lat},${lng}`);
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}(${query})`);
  };

  if (!delivery) {
    return (
      <SafeAreaView className="flex-1 bg-chovia-background" edges={["top", "bottom"]}>
        <RiderHeader title="Delivery Details" />
        <View className="px-5 pt-8">
          <EmptyState
            title="Delivery not found in active session"
            description="Return to Home to view available requests."
            actionLabel="Go Home"
            onAction={() => router.replace("/(tabs)")}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading && !tracking) {
    return (
      <SafeAreaView className="flex-1 bg-chovia-background">
        <RiderHeader title={`Order #${delivery.orderNumber}`} />
        <LoadingView label="Loading route details..." />
      </SafeAreaView>
    );
  }

  const currentStatus = tracking?.deliveryStatus ?? delivery.status;
  const statusMeta = getDeliveryStatusMeta(currentStatus);

  return (
    <SafeAreaView className="flex-1 bg-chovia-background" edges={["top", "bottom"]}>
      <RiderHeader
        title={`Order #${delivery.orderNumber}`}
        onBack={() => router.replace("/(tabs)")}
      />

      <ScrollView
        className="flex-1 px-5"
        contentContainerClassName="pb-8 pt-2 gap-4"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={COLORS.primary}
          />
        }
      >
        <View className="flex-row items-center justify-between rounded-[16px] bg-chovia-card p-4">
          <View>
            <Text className="font-manrope text-[12px] text-chovia-subtle">TRIP EARNINGS</Text>
            <Text className="font-manrope-bold text-[22px] text-chovia-green">
              {delivery.riderEarningsFormatted}
            </Text>
          </View>
          <View className={`rounded-full px-3 py-1 ${statusMeta.bgClass}`}>
            <Text className={`font-manrope-semibold text-[12px] ${statusMeta.textClass}`}>
              {statusMeta.label}
            </Text>
          </View>
        </View>

        {/* Pickup Stop */}
        <View className="gap-2 rounded-[16px] bg-chovia-card p-4">
          <View className="flex-row items-center gap-2">
            <PinIcon size={18} color={COLORS.primary} />
            <Text className="font-manrope-semibold text-[15px] text-chovia-deep">
              Pickup • {tracking?.restaurant.name ?? delivery.restaurantName}
            </Text>
          </View>
          <Text className="font-manrope text-[13px] text-chovia-muted">
            {tracking?.restaurant.address ?? delivery.restaurantAddress}
          </Text>
          {currentStatus === "ASSIGNED" && tracking?.restaurant && (
            <View className="mt-2">
              <Button
                label="Navigate to Restaurant"
                variant="secondary"
                onPress={() =>
                  openExternalMaps(
                    tracking.restaurant.latitude,
                    tracking.restaurant.longitude,
                    tracking.restaurant.name
                  )
                }
              />
            </View>
          )}
        </View>

        {/* Customer Dropoff Stop */}
        <View className="gap-2 rounded-[16px] bg-chovia-card p-4">
          <View className="flex-row items-center gap-2">
            <PinIcon size={18} color={COLORS.gold} />
            <Text className="font-manrope-semibold text-[15px] text-chovia-deep">
              Dropoff Destination
            </Text>
          </View>
          <Text className="font-manrope text-[13px] text-chovia-muted">
            {tracking?.destination.addressText ?? delivery.deliveryAddressText}
          </Text>
          {currentStatus === "OUT_FOR_DELIVERY" && tracking?.destination && (
            <View className="mt-2">
              <Button
                label="Navigate to Customer"
                variant="secondary"
                onPress={() =>
                  openExternalMaps(
                    tracking.destination.latitude,
                    tracking.destination.longitude,
                    "Customer Dropoff"
                  )
                }
              />
            </View>
          )}
        </View>

        {/* Checklist / Instructions */}
        {currentStatus === "ASSIGNED" && (
          <View className="gap-2 rounded-[16px] bg-chovia-card p-4">
            <View className="flex-row items-center gap-2">
              <CheckIcon size={18} color={COLORS.primary} />
              <Text className="font-manrope-semibold text-[14px] text-chovia-deep">
                Pickup Checklist
              </Text>
            </View>
            <Text className="font-manrope text-[13px] leading-[19px] text-chovia-muted">
              Only confirm once the restaurant hands you the sealed order package for Order #
              {delivery.orderNumber}.
            </Text>
          </View>
        )}

        {currentStatus === "DELIVERED" && (
          <View className="gap-2 rounded-[16px] border border-emerald-200 bg-emerald-50 p-4">
            <Text className="font-manrope-bold text-[16px] text-chovia-green">
              Delivery Complete!
            </Text>
            <Text className="font-manrope text-[13px] text-chovia-deep">
              Order #{delivery.orderNumber} has been marked delivered on the server.
            </Text>
          </View>
        )}
      </ScrollView>

      <View className="border-t border-chovia-border bg-chovia-card px-5 py-4">
        {currentStatus === "ASSIGNED" && (
          <Button
            label="Order collected"
            onPress={() => void handleConfirmPickup()}
            loading={pickupDelivery.isPending}
          />
        )}
        {currentStatus === "OUT_FOR_DELIVERY" && (
          <Button
            label="Confirm delivery complete"
            onPress={() => void handleConfirmComplete()}
            loading={completeDelivery.isPending}
          />
        )}
        {currentStatus === "DELIVERED" && (
          <Button label="Back to Home" onPress={() => router.replace("/(tabs)")} />
        )}
      </View>
    </SafeAreaView>
  );
}
