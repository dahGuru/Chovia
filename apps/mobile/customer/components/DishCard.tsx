import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { MenuItemResponseDto } from "../services/restaurantService";
import { COLORS } from "../utils/theme";
import { HeartIcon, MinusIcon, PlusIcon } from "./Icons";
import fallbackDishImg from "../assets/images/jollof_chicken.png";

interface DishCardProps {
  item: MenuItemResponseDto;
  quantityInCart?: number | undefined;
  isFavorite?: boolean | undefined;
  onAdd: () => void;
  onDecrement?: (() => void) | undefined;
  onToggleFavorite?: (() => void) | undefined;
  disabled?: boolean | undefined;
}

export const DishCard: React.FC<DishCardProps> = ({
  item,
  quantityInCart = 0,
  isFavorite = false,
  onAdd,
  onDecrement,
  onToggleFavorite,
  disabled = false,
}) => {
  const isAvailable = item.availability === "AVAILABLE";

  return (
    <View style={styles.card}>
      <View className="relative h-[108px] w-full overflow-hidden rounded-[12px] bg-chovia-background">
        <Image
          source={item.imageUrl ? { uri: item.imageUrl } : fallbackDishImg}
          className="h-full w-full"
          resizeMode="cover"
        />
        {onToggleFavorite && (
          <TouchableOpacity
            onPress={onToggleFavorite}
            activeOpacity={0.8}
            className="absolute right-2 top-2 h-7 w-7 items-center justify-center rounded-full bg-white/90"
            accessibilityLabel={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <HeartIcon size={15} filled={isFavorite} />
          </TouchableOpacity>
        )}
        {!isAvailable && (
          <View className="absolute inset-0 items-center justify-center bg-black/45">
            <Text className="font-manrope-semibold text-[11px] text-white">Unavailable</Text>
          </View>
        )}
      </View>

      <View className="mt-2 gap-1">
        <Text
          numberOfLines={1}
          className="font-manrope-semibold text-[14px] leading-[20px] text-chovia-deep"
        >
          {item.name}
        </Text>
        <View className="flex-row items-center justify-between">
          <Text className="font-manrope-medium text-[12px] leading-[18px] text-chovia-deep">
            {item.priceFormatted}
          </Text>

          {quantityInCart > 0 && onDecrement ? (
            <View className="flex-row items-center gap-1.5 rounded-full bg-chovia-background px-1.5 py-0.5">
              <TouchableOpacity
                onPress={onDecrement}
                disabled={disabled}
                className="h-5 w-5 items-center justify-center rounded-full bg-chovia-green"
              >
                <MinusIcon size={10} color={COLORS.white} />
              </TouchableOpacity>
              <Text className="min-w-[14px] text-center font-manrope-bold text-[12px] text-chovia-deep">
                {quantityInCart}
              </Text>
              <TouchableOpacity
                onPress={onAdd}
                disabled={disabled || !isAvailable || quantityInCart >= item.maxQuantity}
                className="h-5 w-5 items-center justify-center rounded-full bg-chovia-green"
              >
                <PlusIcon size={10} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={onAdd}
              disabled={disabled || !isAvailable}
              className={`h-6 w-6 items-center justify-center rounded-[8px] ${
                isAvailable ? "bg-chovia-green" : "bg-chovia-dotInactive"
              }`}
              accessibilityLabel={`Add ${item.name} to cart`}
            >
              <PlusIcon size={12} color={COLORS.white} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
});
