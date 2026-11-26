import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { useCart } from "../hooks/useCustomerQueries";
import { useLocationStore } from "../store/useLocationStore";
import { CartBagIcon } from "./Icons";

export const FloatingCartBar: React.FC = () => {
  const selectedAddressId = useLocationStore((s) => s.selectedAddressId);
  const { data: cart } = useCart(selectedAddressId);

  if (!cart || cart.itemCount === 0) {
    return null;
  }

  return (
    <View className="px-5 pb-3 pt-1">
      <TouchableOpacity
        onPress={() => router.push("/orders/cart")}
        activeOpacity={0.9}
        style={styles.bar}
      >
        <View className="flex-row items-center gap-3">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-white/15">
            <CartBagIcon size={18} color="#FFFFFF" />
          </View>
          <View>
            <Text className="font-manrope-semibold text-[14px] text-white">
              View Cart ({cart.itemCount} {cart.itemCount === 1 ? "item" : "items"})
            </Text>
            {cart.restaurantName && (
              <Text className="font-manrope text-[11px] text-white/80" numberOfLines={1}>
                {cart.restaurantName}
              </Text>
            )}
          </View>
        </View>
        <Text className="font-manrope-bold text-[15px] text-white">
          {cart.pricing.subtotalFormatted}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    backgroundColor: "#235347",
    borderRadius: 99,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#0D2621",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
});
