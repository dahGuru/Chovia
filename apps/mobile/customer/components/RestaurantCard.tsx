import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { RestaurantResponseDto } from "../services/restaurantService";
import { COLORS } from "../utils/theme";
import { StarIcon } from "./Icons";
import fallbackRestaurantImg from "../assets/images/res_foodklass.png";

interface RestaurantCardProps {
  restaurant: RestaurantResponseDto;
  onPress: () => void;
  compact?: boolean;
}

export const RestaurantCard: React.FC<RestaurantCardProps> = ({
  restaurant,
  onPress,
  compact = false,
}) => {
  const isOpen = restaurant.availability === "OPEN";
  const cuisineLabel =
    restaurant.cuisines && restaurant.cuisines.length > 0
      ? restaurant.cuisines.slice(0, 2).join(" • ")
      : "Local Kitchen";

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.card, compact ? { width: "48%" } : { width: "100%" }]}
    >
      <View className="relative h-[112px] w-full overflow-hidden rounded-[12px] bg-chovia-background">
        <Image source={fallbackRestaurantImg} className="h-full w-full" resizeMode="cover" />
        <View
          className={`absolute left-2 top-2 rounded-full px-2 py-0.5 ${
            isOpen ? "bg-emerald-600/90" : "bg-slate-700/85"
          }`}
        >
          <Text className="font-manrope-medium text-[10px] text-white">
            {isOpen ? "Open" : "Closed"}
          </Text>
        </View>
      </View>

      <View className="mt-2 gap-0.5">
        <Text
          numberOfLines={1}
          className="font-manrope-semibold text-[14px] leading-[20px] text-chovia-deep"
        >
          {restaurant.name}
        </Text>
        <Text numberOfLines={1} className="font-manrope text-[12px] text-chovia-muted">
          {cuisineLabel}
        </Text>
        <View className="mt-0.5 flex-row items-center gap-1.5">
          <StarIcon size={13} color={COLORS.gold} />
          <Text className="font-manrope-medium text-[12px] text-chovia-deep">4.8</Text>
          {typeof restaurant.distanceKm === "number" && (
            <>
              <Text className="text-[12px] text-chovia-subtle">•</Text>
              <Text className="font-manrope text-[12px] text-chovia-subtle">
                {restaurant.distanceKm.toFixed(1)} km
              </Text>
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
});
