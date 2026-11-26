import React, { useMemo, useRef, useState } from "react";
import {
  Alert,
  Linking,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ScreenHeader } from "../../components/AccountHeader";
import { Button } from "../../components/Button";
import { ChevronRightIcon, PinIcon } from "../../components/Icons";
import { EmptyState, LoadingView } from "../../components/StateViews";
import {
  useAddresses,
  useCart,
  useCheckout,
  useInitializePayment,
  useVerifyPayment,
} from "../../hooks/useCustomerQueries";
import { ApiClientError } from "../../services/api";
import { useLocationStore } from "../../store/useLocationStore";
import { COLORS } from "../../utils/theme";

function createIdempotencyKey(): string {
  return `chovia-chk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function CustomerCheckoutScreen() {
  const selectedAddressId = useLocationStore((s) => s.selectedAddressId);
  const { data: addresses, isLoading: loadingAddresses } = useAddresses();

  const activeAddress = useMemo(() => {
    if (!addresses || addresses.length === 0) return null;
    if (selectedAddressId) {
      const match = addresses.find((a) => a.id === selectedAddressId);
      if (match) return match;
    }
    return addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
  }, [addresses, selectedAddressId]);

  const { data: cart, isLoading: loadingCart } = useCart(activeAddress?.id ?? null);

  const checkoutMutation = useCheckout();
  const initializePayment = useInitializePayment();
  const verifyPayment = useVerifyPayment();

  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingPayment, setPendingPayment] = useState<{
    orderId: string;
    orderNumber: string;
    reference: string;
    authorizationUrl: string;
    amountFormatted: string;
  } | null>(null);

  // Preserve a single idempotency key per checkout attempt to avoid duplicate orders
  const idempotencyKeyRef = useRef<string>(createIdempotencyKey());

  const handlePlaceOrder = async () => {
    if (!activeAddress) {
      Alert.alert("Delivery address required", "Please add or select a delivery address first.");
      return;
    }
    if (!cart || cart.itemCount === 0) {
      Alert.alert("Cart is empty", "Please add items to your cart before checking out.");
      return;
    }

    setErrorMsg(null);
    try {
      const order = await checkoutMutation.mutateAsync({
        addressId: activeAddress.id,
        idempotencyKey: idempotencyKeyRef.current,
        notes: notes.trim() || undefined,
      });

      const paymentInit = await initializePayment.mutateAsync({
        orderId: order.id,
      });

      setPendingPayment({
        orderId: order.id,
        orderNumber: order.orderNumber,
        reference: paymentInit.reference,
        authorizationUrl: paymentInit.authorizationUrl,
        amountFormatted: paymentInit.amountFormatted,
      });

      const canOpen = await Linking.canOpenURL(paymentInit.authorizationUrl);
      if (canOpen) {
        await Linking.openURL(paymentInit.authorizationUrl);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof ApiClientError
          ? err.message
          : "Checkout failed. Please review your details and try again."
      );
    }
  };

  const handleVerifyPayment = async () => {
    if (!pendingPayment) return;
    setErrorMsg(null);
    try {
      const result = await verifyPayment.mutateAsync(pendingPayment.reference);
      if (result.status === "SUCCESS") {
        idempotencyKeyRef.current = createIdempotencyKey();
        router.replace(`/orders/${pendingPayment.orderId}`);
      } else if (result.status === "PENDING") {
        Alert.alert(
          "Payment still pending",
          "Paystack has not confirmed this transaction yet. Complete payment in your browser and tap Verify again."
        );
      } else {
        setErrorMsg(
          `Payment ${result.status.toLowerCase()}. You can retry payment from your order details.`
        );
      }
    } catch (err) {
      setErrorMsg(
        err instanceof ApiClientError
          ? err.message
          : "Unable to verify payment status with server."
      );
    }
  };

  if (loadingAddresses || loadingCart) {
    return (
      <SafeAreaView className="flex-1 bg-chovia-background">
        <ScreenHeader title="Checkout" />
        <LoadingView label="Preparing checkout..." />
      </SafeAreaView>
    );
  }

  if (pendingPayment) {
    return (
      <SafeAreaView className="flex-1 bg-chovia-background" edges={["top", "bottom"]}>
        <ScreenHeader title="Complete Payment" />
        <View className="flex-1 justify-center px-5">
          <View className="gap-4 rounded-[20px] bg-chovia-card p-6">
            <Text className="font-manrope-bold text-[20px] text-chovia-deep">
              Order #{pendingPayment.orderNumber}
            </Text>
            <Text className="font-manrope text-[14px] leading-[21px] text-chovia-muted">
              Complete your Paystack payment of{" "}
              <Text className="font-manrope-bold text-chovia-deep">
                {pendingPayment.amountFormatted}
              </Text>{" "}
              in your browser, then tap Verify Payment below so the server confirms your order.
            </Text>
            <Text className="font-manrope text-[12px] text-chovia-subtle">
              Reference: {pendingPayment.reference}
            </Text>

            {errorMsg && (
              <View className="rounded-[12px] border border-red-200 bg-red-50 p-3">
                <Text className="font-manrope text-[13px] text-chovia-error">{errorMsg}</Text>
              </View>
            )}

            <Button
              label="Verify Payment Status"
              onPress={() => void handleVerifyPayment()}
              loading={verifyPayment.isPending}
            />
            <Button
              label="Open Paystack Checkout Again"
              variant="secondary"
              onPress={() => void Linking.openURL(pendingPayment.authorizationUrl)}
            />
            <Button
              label="View Order Details"
              variant="text"
              onPress={() => router.replace(`/orders/${pendingPayment.orderId}`)}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!cart || cart.itemCount === 0) {
    return (
      <SafeAreaView className="flex-1 bg-chovia-background">
        <ScreenHeader title="Checkout" />
        <View className="px-5 pt-8">
          <EmptyState
            title="Nothing to check out"
            description="Your cart is empty."
            actionLabel="Browse Restaurants"
            onAction={() => router.replace("/(tabs)")}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-chovia-background" edges={["top", "bottom"]}>
      <ScreenHeader title="Checkout" />

      <ScrollView className="flex-1 px-5" contentContainerClassName="pb-6 pt-2 gap-4">
        {errorMsg && (
          <View className="rounded-[12px] border border-red-200 bg-red-50 p-3.5">
            <Text className="font-manrope-medium text-[13px] text-chovia-error">{errorMsg}</Text>
          </View>
        )}

        {/* Delivery Address */}
        <TouchableOpacity
          onPress={() => router.push("/profile/addresses")}
          activeOpacity={0.8}
          className="flex-row items-center gap-3 rounded-[16px] bg-chovia-card p-4"
        >
          <View className="h-10 w-10 items-center justify-center rounded-full bg-chovia-background">
            <PinIcon size={20} color={COLORS.primary} />
          </View>
          <View className="flex-1">
            <Text className="font-manrope text-[12px] text-chovia-subtle">Delivery Address</Text>
            <Text className="font-manrope-semibold text-[14px] text-chovia-deep">
              {activeAddress ? activeAddress.label : "No delivery address selected"}
            </Text>
            {activeAddress && (
              <Text numberOfLines={2} className="font-manrope text-[12px] text-chovia-muted">
                {activeAddress.addressText}
              </Text>
            )}
          </View>
          <ChevronRightIcon size={18} color={COLORS.deep} />
        </TouchableOpacity>

        {/* Delivery Instructions */}
        <View className="gap-2 rounded-[16px] bg-chovia-card p-4">
          <Text className="font-manrope-semibold text-[14px] text-chovia-deep">
            Delivery Instructions (Optional)
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            maxLength={255}
            multiline
            placeholder="Gate code, landmark, or drop-off note..."
            placeholderTextColor={COLORS.subtle}
            className="min-h-[68px] rounded-[12px] border border-[#CBD8D1] bg-chovia-background p-3 font-manrope text-[13px] text-chovia-deep"
          />
        </View>

        {/* Payment Method */}
        <View className="gap-2 rounded-[16px] bg-chovia-card p-4">
          <Text className="font-manrope-semibold text-[14px] text-chovia-deep">Payment Method</Text>
          <View className="flex-row items-center justify-between rounded-[12px] border border-chovia-green bg-emerald-50 p-3">
            <View>
              <Text className="font-manrope-semibold text-[14px] text-chovia-deep">
                Paystack Secure Checkout
              </Text>
              <Text className="font-manrope text-[12px] text-chovia-muted">
                Card, Bank Transfer, or USSD (verified server-side)
              </Text>
            </View>
            <View className="h-4 w-4 rounded-full border-4 border-chovia-green bg-white" />
          </View>
        </View>

        {/* Authoritative Total Breakdown */}
        <View className="gap-2.5 rounded-[16px] bg-chovia-card p-4">
          <Text className="font-manrope-semibold text-[15px] text-chovia-deep">
            {cart.restaurantName ?? "Order Summary"} ({cart.itemCount} items)
          </Text>
          <View className="flex-row justify-between">
            <Text className="font-manrope text-[13px] text-chovia-muted">Subtotal</Text>
            <Text className="font-manrope-medium text-[13px] text-chovia-deep">
              {cart.pricing.subtotalFormatted}
            </Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="font-manrope text-[13px] text-chovia-muted">Delivery Fee</Text>
            <Text className="font-manrope-medium text-[13px] text-chovia-deep">
              {cart.pricing.deliveryFeeFormatted}
            </Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="font-manrope text-[13px] text-chovia-muted">Platform Fee</Text>
            <Text className="font-manrope-medium text-[13px] text-chovia-deep">
              {cart.pricing.platformFeeFormatted}
            </Text>
          </View>
          <View className="my-1 h-[1px] bg-chovia-border" />
          <View className="flex-row justify-between">
            <Text className="font-manrope-bold text-[15px] text-chovia-deep">Total Due</Text>
            <Text className="font-manrope-bold text-[16px] text-chovia-green">
              {cart.pricing.totalFormatted}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View className="border-t border-chovia-border bg-chovia-card px-5 py-4">
        <Button
          label={`Place Order • ${cart.pricing.totalFormatted}`}
          onPress={() => void handlePlaceOrder()}
          disabled={!activeAddress}
          loading={checkoutMutation.isPending || initializePayment.isPending}
        />
      </View>
    </SafeAreaView>
  );
}
