import React from "react";
import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ScreenHeader } from "../../components/AccountHeader";
import { HeartIcon } from "../../components/Icons";
import { EmptyState, ErrorState, LoadingView } from "../../components/StateViews";
import { useFavorites, useToggleFavorite } from "../../hooks/useCustomerQueries";
import { ApiClientError } from "../../services/api";
import fallbackDishImg from "../../assets/images/jollof_chicken.png";

export default function CustomerFavoritesScreen() {
  const { data: favorites, isLoading, isError, error, refetch } = useFavorites();
  const toggleFavorite = useToggleFavorite();

  return (
    <SafeAreaView className="flex-1 bg-chovia-background" edges={["top", "bottom"]}>
      <ScreenHeader title="Favourites" />

      <ScrollView className="flex-1 px-5" contentContainerClassName="pb-8 pt-3 gap-3">
        {isLoading ? (
          <LoadingView label="Loading saved dishes..." />
        ) : isError ? (
          <ErrorState
            message={
              error instanceof ApiClientError ? error.message : "Could not load favourites."
            }
            onRetry={() => void refetch()}
          />
        ) : !favorites || favorites.length === 0 ? (
          <EmptyState
            title="No favourites yet"
            description="Tap the heart icon on any dish to save it for quick ordering later."
            actionLabel="Browse Restaurants"
            onAction={() => router.replace("/(tabs)")}
          />
        ) : (
          favorites.map((fav) => (
            <TouchableOpacity
              key={fav.id}
              onPress={() => router.push(`/restaurant/${fav.restaurantId}`)}
              activeOpacity={0.85}
              className="flex-row items-center gap-3 rounded-[16px] bg-chovia-card p-3"
            >
              <Image
                source={fav.imageUrl ? { uri: fav.imageUrl } : fallbackDishImg}
                className="h-16 w-16 rounded-[12px] bg-chovia-background"
                resizeMode="cover"
              />
              <View className="flex-1 gap-0.5">
                <Text className="font-manrope-semibold text-[15px] text-chovia-deep">
                  {fav.name}
                </Text>
                <Text className="font-manrope text-[12px] text-chovia-muted">
                  {fav.restaurantName}
                </Text>
                <Text className="font-manrope-bold text-[13px] text-chovia-green">
                  {fav.priceFormatted}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => void toggleFavorite.mutate(fav.menuItemId)}
                className="p-2"
              >
                <HeartIcon size={20} filled />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
