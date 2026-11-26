import React from "react";
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { EmptyState, ErrorState, LoadingView } from "../../components/StateViews";
import { useActiveDelivery, useRiderDeliveryHistory } from "../../hooks/useRiderQueries";
import { ApiClientError } from "../../services/api";
import { useAuthStore } from "../../store/useAuthStore";
import { useRiderStore } from "../../store/useRiderStore";
import { formatShortDate, getDeliveryStatusMeta } from "../../utils/formatters";
import { COLORS } from "../../utils/theme";

export default function RiderDeliveriesHistoryScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const storeActiveDelivery = useRiderStore((s) => s.activeDelivery);

  const { data: serverActiveDelivery } = useActiveDelivery();
  const activeDelivery = serverActiveDelivery ?? storeActiveDelivery;

  const {
    data: history,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useRiderDeliveryHistory({ page: 1, limit: 30 });

  if (!isAuthenticated) {
    return (
      <SafeAreaView className="flex-1 bg-chovia-background" edges={["top"]}>
        <View className="flex-1 justify-center px-5">
          <EmptyState
            title="Deliveries"
            description="Log in with your CHOVIA Rider account to view active and past deliveries."
            actionLabel="Log in"
            onAction={() => router.replace("/(auth)/login")}
          />
        </View>
      </SafeAreaView>
    );
  }

  const pastDeliveries = (history?.items ?? []).filter((d) => d.id !== activeDelivery?.id);

  return (
    <SafeAreaView className="flex-1 bg-chovia-background" edges={["top"]}>
      <View className="px-5 pb-3 pt-3">
        <Text className="font-manrope-bold text-[24px] text-chovia-deep">Deliveries</Text>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerClassName="pb-8 pt-2 gap-3"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={COLORS.primary}
          />
        }
      >
        {activeDelivery && (
          <TouchableOpacity
            onPress={() => router.push(`/deliveries/${activeDelivery.id}`)}
            className="gap-2 rounded-[16px] border border-chovia-green bg-emerald-50 p-4"
          >
            <View className="flex-row items-center justify-between">
              <Text className="font-manrope-bold text-[15px] text-chovia-deep">
                Active • #{activeDelivery.orderNumber}
              </Text>
              <Text className="font-manrope-bold text-[14px] text-chovia-green">
                {activeDelivery.riderEarningsFormatted}
              </Text>
            </View>
            <Text className="font-manrope text-[13px] text-chovia-muted">
              {activeDelivery.restaurantName} → {activeDelivery.deliveryAddressText}
            </Text>
          </TouchableOpacity>
        )}

        {isLoading && !history ? (
          <LoadingView label="Loading delivery history..." />
        ) : isError ? (
          <ErrorState
            message={
              error instanceof ApiClientError ? error.message : "Could not load delivery history."
            }
            onRetry={() => void refetch()}
          />
        ) : pastDeliveries.length === 0 && !activeDelivery ? (
          <EmptyState
            title="No deliveries yet"
            description="Go online on the Home tab to accept available delivery assignments."
            actionLabel="Go to Home"
            onAction={() => router.replace("/(tabs)")}
          />
        ) : (
          pastDeliveries.map((item) => {
            const meta = getDeliveryStatusMeta(item.status);
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => router.push(`/deliveries/${item.id}`)}
                className="gap-2 rounded-[16px] bg-chovia-card p-4"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="font-manrope-semibold text-[15px] text-chovia-deep">
                    Order #{item.orderNumber}
                  </Text>
                  <View className={`rounded-full px-2.5 py-0.5 ${meta.bgClass}`}>
                    <Text className={`font-manrope-medium text-[11px] ${meta.textClass}`}>
                      {meta.label}
                    </Text>
                  </View>
                </View>
                <Text className="font-manrope text-[12px] text-chovia-muted">
                  {item.restaurantName} → {item.deliveryAddressText}
                </Text>
                <View className="flex-row items-center justify-between border-t border-chovia-border pt-2">
                  <Text className="font-manrope text-[11px] text-chovia-subtle">
                    {formatShortDate(item.deliveredAt ?? item.createdAt)}
                  </Text>
                  <Text className="font-manrope-bold text-[14px] text-chovia-green">
                    {item.riderEarningsFormatted}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
