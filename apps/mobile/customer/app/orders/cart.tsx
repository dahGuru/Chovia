import React, { useMemo } from "react";
import { Alert, Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ScreenHeader } from "../../components/AccountHeader";
import { Button } from "../../components/Button";
import { MinusIcon, PlusIcon } from "../../components/Icons";
import { EmptyState, ErrorState, LoadingView } from "../../components/StateViews";
import {
  useAddresses,
  useCart,
  useClearCart,
  useRemoveCartItem,
  useUpdateCartItem,
} from "../../hooks/useCustomerQueries";
import { ApiClientError } from "../../services/api";
import { useAuthStore } from "../../store/useAuthStore";
import { useLocationStore } from "../../store/useLocationStore";
import { COLORS } from "../../utils/theme";
import fallbackDishImg from "../../assets/images/jollof_chicken.png";

export default function CustomerCartScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const selectedAddressId = useLocationStore((s) => s.selectedAddressId);

  const { data: addresses } = useAddresses();
  const effectiveAddressId = useMemo(() => {
    if (selectedAddressId) return selectedAddressId;
    return addresses?.find((a) => a.isDefault)?.id ?? addresses?.[0]?.id ?? null;
  }, [addresses, selectedAddressId]);

  const {
    data: cart,
    isLoading,
    isError,
    error,
    refetch,
  } = useCart(effectiveAddressId);

  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  const clearCart = useClearCart();

  if (!isAuthenticated) {
    return (
      <SafeAreaView className="flex-1 bg-chovia-background">
        <ScreenHeader title="Your Cart" />
        <View className="px-5 pt-8">
          <EmptyState
            title="Sign in to view your cart"
            description="Log in to manage your items and check out."
            actionLabel="Log in"
            onAction={() => router.push("/(auth)/login")}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-chovia-background">
        <ScreenHeader title="Your Cart" />
        <LoadingView label="Loading cart..." />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-chovia-background">
        <ScreenHeader title="Your Cart" />
        <View className="px-5 pt-6">
          <ErrorState
            message={error instanceof ApiClientError ? error.message : "Failed to load cart."}
            onRetry={() => void refetch()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const hasUnavailableItems = (cart?.items ?? []).some((i) => i.availability === "UNAVAILABLE");

  const handleClear = () => {
    Alert.alert("Clear cart?", "Remove all items from your current cart?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => void clearCart.mutate(),
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-chovia-background" edges={["top", "bottom"]}>
      <ScreenHeader
        title="Cart Summary"
        rightSlot={
          cart && cart.itemCount > 0 ? (
            <TouchableOpacity onPress={handleClear}>
              <Text className="font-manrope-medium text-[13px] text-chovia-error">Clear</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {!cart || cart.itemCount === 0 ? (
        <View className="flex-1 justify-center px-5">
          <EmptyState
            title="Your cart is empty"
            description="Explore local restaurants and add your favourite dishes to get started."
            actionLabel="Browse Restaurants"
            onAction={() => router.replace("/(tabs)")}
          />
        </View>
      ) : (
        <View className="flex-1">
          <ScrollView className="flex-1 px-5" contentContainerClassName="pb-6 pt-2 gap-3">
            {cart.restaurantName && (
              <View className="rounded-[14px] bg-chovia-card px-4 py-3">
                <Text className="font-manrope text-[12px] text-chovia-subtle">Ordering from</Text>
                <Text className="font-manrope-semibold text-[16px] text-chovia-deep">
                  {cart.restaurantName}
                </Text>
              </View>
            )}

            {hasUnavailableItems && (
              <View className="rounded-[12px] border border-amber-300 bg-amber-50 p-3.5">
                <Text className="font-manrope-medium text-[13px] text-amber-800">
                  One or more items in your cart are currently unavailable. Please remove them
                  before checking out.
                </Text>
              </View>
            )}

            {cart.items.map((item) => (
              <View
                key={item.id}
                className="flex-row items-center gap-3 rounded-[16px] bg-chovia-card p-3"
              >
                <Image
                  source={item.imageUrl ? { uri: item.imageUrl } : fallbackDishImg}
                  className="h-16 w-16 rounded-[12px] bg-chovia-background"
                  resizeMode="cover"
                />
                <View className="flex-1 gap-1">
                  <Text
                    numberOfLines={1}
                    className="font-manrope-semibold text-[14px] text-chovia-deep"
                  >
                    {item.name}
                  </Text>
                  <Text className="font-manrope text-[12px] text-chovia-muted">
                    {item.priceFormatted} each
                  </Text>
                  {item.availability === "UNAVAILABLE" && (
                    <Text className="font-manrope-semibold text-[11px] text-chovia-error">
                      Currently unavailable
                    </Text>
                  )}
                  <Text className="font-manrope-bold text-[13px] text-chovia-green">
                    {item.itemTotalFormatted}
                  </Text>
                </View>

                <View className="flex-row items-center gap-2 rounded-full bg-chovia-background px-2 py-1">
                  <TouchableOpacity
                    onPress={() => {
                      if (item.quantity <= 1) {
                        void removeItem.mutate(item.id);
                      } else {
                        void updateItem.mutate({ itemId: item.id, quantity: item.quantity - 1 });
                      }
                    }}
                    disabled={updateItem.isPending || removeItem.isPending}
                    className="h-6 w-6 items-center justify-center rounded-full bg-chovia-green"
                  >
                    <MinusIcon size={11} color={COLORS.white} />
                  </TouchableOpacity>
                  <Text className="min-w-[16px] text-center font-manrope-bold text-[13px] text-chovia-deep">
                    {item.quantity}
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      void updateItem.mutate({ itemId: item.id, quantity: item.quantity + 1 })
                    }
                    disabled={updateItem.isPending || item.availability === "UNAVAILABLE"}
                    className="h-6 w-6 items-center justify-center rounded-full bg-chovia-green"
                  >
                    <PlusIcon size={11} color={COLORS.white} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {/* Server-calculated Pricing Breakdown */}
            <View className="mt-2 gap-2.5 rounded-[16px] bg-chovia-card p-4">
              <Text className="font-manrope-semibold text-[15px] text-chovia-deep">
                Order Summary
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
                <Text className="font-manrope-bold text-[15px] text-chovia-deep">Total</Text>
                <Text className="font-manrope-bold text-[16px] text-chovia-green">
                  {cart.pricing.totalFormatted}
                </Text>
              </View>
            </View>
          </ScrollView>

          <View className="border-t border-chovia-border bg-chovia-card px-5 py-4">
            <Button
              label="Proceed to Checkout"
              disabled={hasUnavailableItems}
              onPress={() => router.push("/orders/checkout")}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
