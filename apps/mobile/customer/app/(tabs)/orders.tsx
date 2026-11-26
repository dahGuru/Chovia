import React, { useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { EmptyState, ErrorState, LoadingView } from "../../components/StateViews";
import { useOrders } from "../../hooks/useCustomerQueries";
import { ApiClientError } from "../../services/api";
import { useAuthStore } from "../../store/useAuthStore";
import { formatShortDate, getOrderStatusMeta } from "../../utils/formatters";
import { COLORS } from "../../utils/theme";

const PAST_STATUSES = new Set(["DELIVERED", "CANCELLED", "REJECTED"]);

export default function CustomerOrdersScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [filter, setFilter] = useState<"active" | "past">("active");

  const { data: orders, isLoading, isError, error, refetch, isRefetching } = useOrders();

  const filteredOrders = useMemo(() => {
    const list = orders ?? [];
    return list.filter((o) =>
      filter === "active" ? !PAST_STATUSES.has(o.status) : PAST_STATUSES.has(o.status)
    );
  }, [orders, filter]);

  if (!isAuthenticated) {
    return (
      <SafeAreaView className="flex-1 bg-chovia-background" edges={["top"]}>
        <View className="flex-1 justify-center px-5">
          <EmptyState
            title="Track your orders"
            description="Sign in to view your active deliveries and order history."
            actionLabel="Log in"
            onAction={() => router.push("/(auth)/login")}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-chovia-background" edges={["top"]}>
      <View className="px-5 pb-3 pt-3">
        <Text className="font-manrope-bold text-[24px] text-chovia-deep">Orders</Text>

        <View className="mt-4 flex-row gap-2 rounded-[14px] bg-chovia-card p-1">
          <TouchableOpacity
            onPress={() => setFilter("active")}
            className={`flex-1 items-center rounded-[10px] py-2 ${
              filter === "active" ? "bg-chovia-green" : "bg-transparent"
            }`}
          >
            <Text
              className={`font-manrope-semibold text-[13px] ${
                filter === "active" ? "text-white" : "text-chovia-muted"
              }`}
            >
              Active
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilter("past")}
            className={`flex-1 items-center rounded-[10px] py-2 ${
              filter === "past" ? "bg-chovia-green" : "bg-transparent"
            }`}
          >
            <Text
              className={`font-manrope-semibold text-[13px] ${
                filter === "past" ? "text-white" : "text-chovia-muted"
              }`}
            >
              Past Orders
            </Text>
          </TouchableOpacity>
        </View>
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
        {isLoading ? (
          <LoadingView label="Loading orders..." />
        ) : isError ? (
          <ErrorState
            message={error instanceof ApiClientError ? error.message : "Could not load orders."}
            onRetry={() => void refetch()}
          />
        ) : filteredOrders.length === 0 ? (
          <EmptyState
            title={filter === "active" ? "No active orders" : "No past orders"}
            description={
              filter === "active"
                ? "When you place an order, live updates will appear here."
                : "Your completed and cancelled orders will appear here."
            }
            actionLabel="Explore Restaurants"
            onAction={() => router.replace("/(tabs)")}
          />
        ) : (
          filteredOrders.map((order) => {
            const meta = getOrderStatusMeta(order.status);
            return (
              <TouchableOpacity
                key={order.id}
                onPress={() => router.push(`/orders/${order.id}`)}
                activeOpacity={0.85}
                className="gap-2.5 rounded-[16px] bg-chovia-card p-4"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="font-manrope-semibold text-[15px] text-chovia-deep">
                    {order.restaurantName}
                  </Text>
                  <View className={`rounded-full px-2.5 py-0.5 ${meta.bgClass}`}>
                    <Text className={`font-manrope-medium text-[11px] ${meta.textClass}`}>
                      {meta.label}
                    </Text>
                  </View>
                </View>

                <Text className="font-manrope text-[12px] text-chovia-subtle">
                  Order #{order.orderNumber} • {formatShortDate(order.createdAt)}
                </Text>

                <View className="flex-row items-center justify-between border-t border-chovia-border pt-2.5">
                  <Text className="font-manrope text-[13px] text-chovia-muted">
                    {order.items.length} {order.items.length === 1 ? "item" : "items"}
                  </Text>
                  <Text className="font-manrope-bold text-[14px] text-chovia-green">
                    {order.totalAmountFormatted}
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
