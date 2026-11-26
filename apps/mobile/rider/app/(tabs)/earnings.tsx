import React from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { EmptyState, ErrorState, LoadingView } from "../../components/StateViews";
import { useRiderDeliveryHistory } from "../../hooks/useRiderQueries";
import { ApiClientError } from "../../services/api";
import { useAuthStore } from "../../store/useAuthStore";
import { formatNairaFromMinor, formatShortDate } from "../../utils/formatters";
import { COLORS } from "../../utils/theme";

export default function RiderEarningsScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data, isLoading, isError, error, refetch, isRefetching } = useRiderDeliveryHistory({
    status: "DELIVERED",
    page: 1,
    limit: 20,
  });

  if (!isAuthenticated) {
    return (
      <SafeAreaView className="flex-1 bg-chovia-background" edges={["top"]}>
        <View className="flex-1 justify-center px-5">
          <EmptyState
            title="Rider Earnings"
            description="Log in with your CHOVIA Rider account to view completed trip earnings."
            actionLabel="Log in"
            onAction={() => router.replace("/(auth)/login")}
          />
        </View>
      </SafeAreaView>
    );
  }

  const totalMinor = data?.totalEarningsMinor ?? 0;
  const totalCount = data?.total ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-chovia-background" edges={["top"]}>
      <View className="px-5 pb-3 pt-3">
        <Text className="font-manrope-bold text-[24px] text-chovia-deep">Earnings</Text>
      </View>

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
        {isLoading && !data ? (
          <LoadingView label="Loading earnings..." />
        ) : isError ? (
          <ErrorState
            message={
              error instanceof ApiClientError ? error.message : "Could not load earnings history."
            }
            onRetry={() => void refetch()}
          />
        ) : (
          <>
            <View className="gap-2 rounded-[20px] bg-chovia-green p-5">
              <Text className="font-manrope-bold text-[11px] text-white/80">
                TOTAL COMPLETED DELIVERY EARNINGS
              </Text>
              <Text className="font-manrope-bold text-[32px] text-white">
                {data?.totalEarningsFormatted ?? formatNairaFromMinor(totalMinor)}
              </Text>
              <Text className="font-manrope text-[13px] text-white/85">
                Across {totalCount} {totalCount === 1 ? "completed delivery" : "completed deliveries"}
              </Text>
            </View>

            <View className="gap-2">
              <Text className="font-manrope-semibold text-[16px] text-chovia-deep">
                Recent Completed Trips
              </Text>
              {!data || data.items.length === 0 ? (
                <EmptyState
                  title="No completed trips yet"
                  description="Your completed delivery earnings will appear here once you deliver an order."
                />
              ) : (
                data.items.map((item) => (
                  <View
                    key={item.id}
                    className="flex-row items-center justify-between rounded-[16px] bg-chovia-card p-4"
                  >
                    <View className="flex-1 pr-3">
                      <Text className="font-manrope-semibold text-[14px] text-chovia-deep">
                        Order #{item.orderNumber} • {item.restaurantName}
                      </Text>
                      <Text className="mt-0.5 font-manrope text-[12px] text-chovia-subtle">
                        {formatShortDate(item.deliveredAt ?? item.createdAt)}
                      </Text>
                    </View>
                    <Text className="font-manrope-bold text-[15px] text-chovia-green">
                      {item.riderEarningsFormatted}
                    </Text>
                  </View>
                ))
              )}
            </View>

            <View className="gap-1.5 rounded-[16px] border border-chovia-border bg-chovia-card p-4">
              <Text className="font-manrope-semibold text-[13px] text-chovia-deep">
                Payout Transfers
              </Text>
              <Text className="font-manrope text-[12px] leading-[18px] text-chovia-muted">
                Automated bank settlement transfers are processed against your verified KYC bank
                account on the scheduled payout cycle.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
