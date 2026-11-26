import React from "react";
import { Alert, Linking, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { ScreenHeader } from "../../components/AccountHeader";
import { Button } from "../../components/Button";
import { ErrorState, LoadingView } from "../../components/StateViews";
import {
  useCancelOrder,
  useDeliveryTracking,
  useInitializePayment,
  useOrder,
} from "../../hooks/useCustomerQueries";
import { ApiClientError } from "../../services/api";
import { formatShortDate, getOrderStatusMeta } from "../../utils/formatters";
import { COLORS } from "../../utils/theme";

const CANCELLABLE_STATUSES = new Set(["PENDING_PAYMENT", "PENDING", "CONFIRMED"]);

export default function CustomerOrderDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = typeof id === "string" ? id : "";

  const {
    data: order,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useOrder(orderId);

  const { data: tracking, refetch: refetchTracking } = useDeliveryTracking(orderId);
  const cancelOrder = useCancelOrder();
  const initializePayment = useInitializePayment();

  const handleCancel = () => {
    Alert.alert("Cancel Order?", "Are you sure you want to cancel this order?", [
      { text: "Keep Order", style: "cancel" },
      {
        text: "Cancel Order",
        style: "destructive",
        onPress: () => {
          void cancelOrder
            .mutateAsync({ id: orderId, reason: "Cancelled by customer" })
            .catch((err) => {
              Alert.alert(
                "Unable to cancel",
                err instanceof ApiClientError ? err.message : "Order could not be cancelled."
              );
            });
        },
      },
    ]);
  };

  const handlePayNow = async () => {
    try {
      const paymentInit = await initializePayment.mutateAsync({ orderId });
      await Linking.openURL(paymentInit.authorizationUrl);
    } catch (err) {
      Alert.alert(
        "Payment initialization failed",
        err instanceof ApiClientError ? err.message : "Unable to start payment."
      );
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-chovia-background">
        <ScreenHeader title="Order Tracking" />
        <LoadingView label="Loading order details..." />
      </SafeAreaView>
    );
  }

  if (isError || !order) {
    return (
      <SafeAreaView className="flex-1 bg-chovia-background">
        <ScreenHeader title="Order Tracking" />
        <View className="px-5 pt-6">
          <ErrorState
            message={
              error instanceof ApiClientError ? error.message : "Unable to load order details."
            }
            onRetry={() => void refetch()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const statusMeta = getOrderStatusMeta(order.status);

  return (
    <SafeAreaView className="flex-1 bg-chovia-background" edges={["top", "bottom"]}>
      <ScreenHeader title={`Order #${order.orderNumber}`} />

      <ScrollView
        className="flex-1 px-5"
        contentContainerClassName="pb-8 pt-2 gap-4"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              void refetch();
              void refetchTracking();
            }}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Status Banner */}
        <View className="gap-2 rounded-[16px] bg-chovia-card p-4">
          <View className="flex-row items-center justify-between">
            <Text className="font-manrope-bold text-[17px] text-chovia-deep">
              {order.restaurantName}
            </Text>
            <View className={`rounded-full px-3 py-1 ${statusMeta.bgClass}`}>
              <Text className={`font-manrope-semibold text-[12px] ${statusMeta.textClass}`}>
                {statusMeta.label}
              </Text>
            </View>
          </View>
          <Text className="font-manrope text-[12px] text-chovia-subtle">
            Placed on {formatShortDate(order.createdAt)}
          </Text>
          {tracking && (
            <Text className="font-manrope-medium text-[13px] text-chovia-green">
              Delivery Stage: {tracking.deliveryStatus.replace(/_/g, " ")}
            </Text>
          )}
        </View>

        {/* Pending Payment Action */}
        {order.status === "PENDING_PAYMENT" && (
          <View className="gap-3 rounded-[16px] border border-amber-200 bg-amber-50 p-4">
            <Text className="font-manrope-semibold text-[14px] text-amber-900">
              Payment Required
            </Text>
            <Text className="font-manrope text-[13px] text-amber-800">
              Complete your Paystack checkout so the restaurant can confirm your order.
            </Text>
            <Button
              label="Pay Now via Paystack"
              onPress={() => void handlePayNow()}
              loading={initializePayment.isPending}
            />
          </View>
        )}

        {/* Assigned Rider Info */}
        {tracking?.rider && (
          <View className="gap-2 rounded-[16px] bg-chovia-card p-4">
            <Text className="font-manrope-semibold text-[15px] text-chovia-deep">
              Your Delivery Rider
            </Text>
            <Text className="font-manrope-medium text-[14px] text-chovia-deep">
              {tracking.rider.name}
            </Text>
            {(tracking.rider.vehicleType || tracking.rider.vehiclePlateNumber) && (
              <Text className="font-manrope text-[13px] text-chovia-muted">
                {[tracking.rider.vehicleType, tracking.rider.vehiclePlateNumber]
                  .filter(Boolean)
                  .join(" • ")}
              </Text>
            )}
            <View className="mt-2">
              <Button
                label={`Call Rider (${tracking.rider.phone})`}
                variant="secondary"
                onPress={() => void Linking.openURL(`tel:${tracking.rider!.phone}`)}
              />
            </View>
          </View>
        )}

        {/* Addresses */}
        <View className="gap-2 rounded-[16px] bg-chovia-card p-4">
          <Text className="font-manrope-semibold text-[15px] text-chovia-deep">
            Delivery Route
          </Text>
          {tracking?.restaurant && (
            <View>
              <Text className="font-manrope text-[11px] text-chovia-subtle">PICKUP</Text>
              <Text className="font-manrope-medium text-[13px] text-chovia-deep">
                {tracking.restaurant.name} — {tracking.restaurant.address}
              </Text>
            </View>
          )}
          <View className="mt-1">
            <Text className="font-manrope text-[11px] text-chovia-subtle">DROPOFF</Text>
            <Text className="font-manrope-medium text-[13px] text-chovia-deep">
              {order.deliveryAddressText}
            </Text>
          </View>
        </View>

        {/* Status Timeline */}
        {order.statusHistory && order.statusHistory.length > 0 && (
          <View className="gap-3 rounded-[16px] bg-chovia-card p-4">
            <Text className="font-manrope-semibold text-[15px] text-chovia-deep">
              Order Timeline
            </Text>
            {order.statusHistory.map((step) => (
              <View key={step.id} className="flex-row items-start gap-3">
                <View className="mt-1.5 h-2.5 w-2.5 rounded-full bg-chovia-green" />
                <View className="flex-1">
                  <Text className="font-manrope-semibold text-[13px] text-chovia-deep">
                    {getOrderStatusMeta(step.toStatus).label}
                  </Text>
                  {step.reason && (
                    <Text className="font-manrope text-[12px] text-chovia-muted">
                      {step.reason}
                    </Text>
                  )}
                  <Text className="font-manrope text-[11px] text-chovia-subtle">
                    {formatShortDate(step.createdAt)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Items & Totals */}
        <View className="gap-2 rounded-[16px] bg-chovia-card p-4">
          <Text className="font-manrope-semibold text-[15px] text-chovia-deep">Items</Text>
          {order.items.map((item) => (
            <View key={item.id} className="flex-row justify-between py-1">
              <Text className="flex-1 font-manrope text-[13px] text-chovia-deep">
                {item.quantity}x {item.itemName}
              </Text>
              <Text className="font-manrope-medium text-[13px] text-chovia-deep">
                {item.lineTotalFormatted}
              </Text>
            </View>
          ))}
          <View className="my-1 h-[1px] bg-chovia-border" />
          <View className="flex-row justify-between">
            <Text className="font-manrope text-[13px] text-chovia-muted">Subtotal</Text>
            <Text className="font-manrope-medium text-[13px] text-chovia-deep">
              {order.subtotalFormatted}
            </Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="font-manrope text-[13px] text-chovia-muted">Delivery Fee</Text>
            <Text className="font-manrope-medium text-[13px] text-chovia-deep">
              {order.deliveryFeeFormatted}
            </Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="font-manrope-bold text-[15px] text-chovia-deep">Total</Text>
            <Text className="font-manrope-bold text-[15px] text-chovia-green">
              {order.totalAmountFormatted}
            </Text>
          </View>
        </View>

        {CANCELLABLE_STATUSES.has(order.status) && (
          <Button
            label="Cancel Order"
            variant="secondary"
            onPress={handleCancel}
            loading={cancelOrder.isPending}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
