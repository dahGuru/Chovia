import React, { useMemo, useState } from "react";
import { Alert, Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { ScreenHeader } from "../../components/AccountHeader";
import { DishCard } from "../../components/DishCard";
import { FloatingCartBar } from "../../components/FloatingCartBar";
import { PinIcon } from "../../components/Icons";
import { EmptyState, ErrorState, LoadingView } from "../../components/StateViews";
import {
  useAddToCart,
  useCart,
  useFavorites,
  useRemoveCartItem,
  useRestaurant,
  useRestaurantMenu,
  useToggleFavorite,
  useUpdateCartItem,
} from "../../hooks/useCustomerQueries";
import { ApiClientError } from "../../services/api";
import type { MenuItemResponseDto } from "../../services/restaurantService";
import { useAuthStore } from "../../store/useAuthStore";
import { useLocationStore } from "../../store/useLocationStore";
import { COLORS } from "../../utils/theme";
import bannerFallbackImg from "../../assets/images/res_foodklass.png";

export default function RestaurantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const restaurantId = typeof id === "string" ? id : "";

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const selectedAddressId = useLocationStore((s) => s.selectedAddressId);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");

  const {
    data: restaurant,
    isLoading: loadingRestaurant,
    isError: isRestaurantError,
    error: restaurantError,
    refetch: refetchRestaurant,
  } = useRestaurant(restaurantId);

  const {
    data: categories,
    isLoading: loadingMenu,
    isError: isMenuError,
    error: menuError,
    refetch: refetchMenu,
  } = useRestaurantMenu(restaurantId);

  const { data: cart } = useCart(selectedAddressId);
  const { data: favorites } = useFavorites();

  const addToCart = useAddToCart();
  const updateCartItem = useUpdateCartItem();
  const removeCartItem = useRemoveCartItem();
  const toggleFavorite = useToggleFavorite();

  const cartItemByMenuId = useMemo(() => {
    const map = new Map<string, { cartItemId: string; quantity: number }>();
    for (const item of cart?.items ?? []) {
      map.set(item.menuItemId, { cartItemId: item.id, quantity: item.quantity });
    }
    return map;
  }, [cart]);

  const favoriteIds = useMemo(
    () => new Set((favorites ?? []).map((f) => f.menuItemId)),
    [favorites]
  );

  const visibleCategories = useMemo(() => {
    if (!categories) return [];
    if (selectedCategoryId === "all") return categories;
    return categories.filter((c) => c.id === selectedCategoryId);
  }, [categories, selectedCategoryId]);

  const handleAddDish = async (item: MenuItemResponseDto) => {
    if (!isAuthenticated) {
      router.push("/(auth)/login");
      return;
    }

    const existing = cartItemByMenuId.get(item.id);
    if (existing) {
      await updateCartItem
        .mutateAsync({ itemId: existing.cartItemId, quantity: existing.quantity + 1 })
        .catch((err) => {
          Alert.alert(
            "Unable to update cart",
            err instanceof ApiClientError ? err.message : "Please try again."
          );
        });
      return;
    }

    // Enforce single-restaurant-per-cart rule clearly
    if (
      cart?.restaurantId &&
      cart.itemCount > 0 &&
      cart.restaurantId !== restaurantId
    ) {
      Alert.alert(
        "Replace current cart?",
        `Your cart contains items from ${cart.restaurantName ?? "another restaurant"}. Clear your cart and add ${item.name}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Replace Cart",
            style: "destructive",
            onPress: () => {
              void addToCart
                .mutateAsync({
                  menuItemId: item.id,
                  quantity: 1,
                  clearCartIfDifferentRestaurant: true,
                })
                .catch((err) => {
                  Alert.alert(
                    "Unable to add item",
                    err instanceof ApiClientError ? err.message : "Please try again."
                  );
                });
            },
          },
        ]
      );
      return;
    }

    await addToCart
      .mutateAsync({
        menuItemId: item.id,
        quantity: 1,
        clearCartIfDifferentRestaurant: false,
      })
      .catch((err) => {
        Alert.alert(
          "Unable to add item",
          err instanceof ApiClientError ? err.message : "Please try again."
        );
      });
  };

  const handleDecrementDish = async (item: MenuItemResponseDto) => {
    const existing = cartItemByMenuId.get(item.id);
    if (!existing) return;

    if (existing.quantity <= 1) {
      await removeCartItem.mutateAsync(existing.cartItemId).catch(() => undefined);
    } else {
      await updateCartItem
        .mutateAsync({ itemId: existing.cartItemId, quantity: existing.quantity - 1 })
        .catch(() => undefined);
    }
  };

  if (loadingRestaurant || loadingMenu) {
    return (
      <SafeAreaView className="flex-1 bg-chovia-background">
        <ScreenHeader title="Restaurant" />
        <LoadingView label="Loading restaurant menu..." />
      </SafeAreaView>
    );
  }

  if (isRestaurantError || !restaurant) {
    return (
      <SafeAreaView className="flex-1 bg-chovia-background">
        <ScreenHeader title="Restaurant" />
        <View className="px-5 pt-6">
          <ErrorState
            message={
              restaurantError instanceof ApiClientError
                ? restaurantError.message
                : "Could not load restaurant details."
            }
            onRetry={() => void refetchRestaurant()}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-chovia-background" edges={["top"]}>
      <View className="flex-1 bg-chovia-background">
        <ScreenHeader title={restaurant.name} />

        <ScrollView className="flex-1" contentContainerClassName="pb-6">
          {/* Restaurant Hero Card */}
          <View className="px-5 pt-2">
            <View className="overflow-hidden rounded-[20px] bg-chovia-card p-3">
              <View className="relative h-[160px] w-full overflow-hidden rounded-[14px]">
                <Image
                  source={bannerFallbackImg}
                  className="h-full w-full"
                  resizeMode="cover"
                />
                <View
                  className={`absolute left-3 top-3 rounded-full px-3 py-1 ${
                    restaurant.availability === "OPEN" ? "bg-emerald-600" : "bg-slate-700"
                  }`}
                >
                  <Text className="font-manrope-semibold text-[11px] text-white">
                    {restaurant.availability === "OPEN" ? "Open Now" : "Currently Closed"}
                  </Text>
                </View>
              </View>

              <View className="mt-3 gap-1">
                <Text className="font-manrope-bold text-[20px] text-chovia-deep">
                  {restaurant.name}
                </Text>
                {restaurant.description && (
                  <Text className="font-manrope text-[13px] leading-[19px] text-chovia-muted">
                    {restaurant.description}
                  </Text>
                )}
                <View className="mt-1 flex-row items-center gap-1.5">
                  <PinIcon size={14} color={COLORS.primary} />
                  <Text className="flex-1 font-manrope text-[12px] text-chovia-subtle">
                    {restaurant.address}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Category Filter Chips */}
          {categories && categories.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="px-5 pt-4 gap-2"
            >
              <TouchableOpacity
                onPress={() => setSelectedCategoryId("all")}
                className={`rounded-full px-4 py-2 ${
                  selectedCategoryId === "all" ? "bg-chovia-green" : "bg-chovia-card"
                }`}
              >
                <Text
                  className={`font-manrope-medium text-[13px] ${
                    selectedCategoryId === "all" ? "text-white" : "text-chovia-deep"
                  }`}
                >
                  All
                </Text>
              </TouchableOpacity>

              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setSelectedCategoryId(cat.id)}
                  className={`rounded-full px-4 py-2 ${
                    selectedCategoryId === cat.id ? "bg-chovia-green" : "bg-chovia-card"
                  }`}
                >
                  <Text
                    className={`font-manrope-medium text-[13px] ${
                      selectedCategoryId === cat.id ? "text-white" : "text-chovia-deep"
                    }`}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Menu Items */}
          <View className="mt-5 px-5">
            {isMenuError ? (
              <ErrorState
                message={
                  menuError instanceof ApiClientError
                    ? menuError.message
                    : "Unable to load menu."
                }
                onRetry={() => void refetchMenu()}
              />
            ) : visibleCategories.length === 0 ? (
              <EmptyState
                title="No menu items yet"
                description="This restaurant hasn't published dishes in this category yet."
              />
            ) : (
              visibleCategories.map((category) => (
                <View key={category.id} className="mb-6">
                  <Text className="mb-3 font-manrope-semibold text-[16px] text-chovia-deep">
                    {category.name}
                  </Text>
                  {category.items.length === 0 ? (
                    <Text className="font-manrope text-[13px] text-chovia-muted">
                      No dishes available in {category.name}.
                    </Text>
                  ) : (
                    <View className="flex-row flex-wrap justify-between gap-y-3.5">
                      {category.items.map((item) => {
                        const cartEntry = cartItemByMenuId.get(item.id);
                        return (
                          <DishCard
                            key={item.id}
                            item={item}
                            quantityInCart={cartEntry?.quantity ?? 0}
                            isFavorite={favoriteIds.has(item.id)}
                            disabled={
                              addToCart.isPending ||
                              updateCartItem.isPending ||
                              removeCartItem.isPending
                            }
                            onAdd={() => void handleAddDish(item)}
                            onDecrement={() => void handleDecrementDish(item)}
                            onToggleFavorite={
                              isAuthenticated
                                ? () => void toggleFavorite.mutate(item.id)
                                : undefined
                            }
                          />
                        );
                      })}
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        </ScrollView>

        <FloatingCartBar />
      </View>
    </SafeAreaView>
  );
}
