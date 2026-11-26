import React, { useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { FloatingCartBar } from "../../components/FloatingCartBar";
import { SearchIcon } from "../../components/Icons";
import { RestaurantCard } from "../../components/RestaurantCard";
import { EmptyState, ErrorState, LoadingView } from "../../components/StateViews";
import { useRestaurants } from "../../hooks/useCustomerQueries";
import { ApiClientError } from "../../services/api";
import { COLORS } from "../../utils/theme";

export default function CustomerMenuBrowseScreen() {
  const [search, setSearch] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);

  const { data, isLoading, isError, error, refetch, isRefetching } = useRestaurants({
    search: search.trim() || undefined,
    limit: 50,
  });

  const restaurants = useMemo(() => {
    const list = data?.items ?? [];
    return onlyOpen ? list.filter((r) => r.availability === "OPEN") : list;
  }, [data, onlyOpen]);

  return (
    <SafeAreaView className="flex-1 bg-chovia-background" edges={["top"]}>
      <View className="flex-1 bg-chovia-background">
        <View className="px-5 pb-3 pt-3">
          <Text className="font-manrope-bold text-[24px] text-chovia-deep">Browse Kitchens</Text>
          <Text className="mt-1 font-manrope text-[13px] text-chovia-muted">
            Select a restaurant to explore its live menu and add dishes to your cart.
          </Text>

          <View className="mt-4 h-[46px] flex-row items-center gap-2.5 rounded-[14px] border border-[#E2EBE6] bg-chovia-card px-3.5">
            <SearchIcon size={18} color={COLORS.subtle} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Filter kitchens by name or cuisine..."
              placeholderTextColor={COLORS.subtle}
              className="flex-1 font-manrope text-[14px] text-chovia-deep"
            />
          </View>

          <View className="mt-3 flex-row gap-2">
            <TouchableOpacity
              onPress={() => setOnlyOpen(false)}
              className={`rounded-full px-4 py-1.5 ${
                !onlyOpen ? "bg-chovia-green" : "bg-chovia-card"
              }`}
            >
              <Text
                className={`font-manrope-medium text-[12px] ${
                  !onlyOpen ? "text-white" : "text-chovia-deep"
                }`}
              >
                All Kitchens
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setOnlyOpen(true)}
              className={`rounded-full px-4 py-1.5 ${
                onlyOpen ? "bg-chovia-green" : "bg-chovia-card"
              }`}
            >
              <Text
                className={`font-manrope-medium text-[12px] ${
                  onlyOpen ? "text-white" : "text-chovia-deep"
                }`}
              >
                Open Now
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          className="flex-1 px-5"
          contentContainerClassName="pb-6 gap-3"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor={COLORS.primary}
            />
          }
        >
          {isLoading ? (
            <LoadingView label="Loading kitchens..." />
          ) : isError ? (
            <ErrorState
              message={
                error instanceof ApiClientError ? error.message : "Could not fetch kitchens."
              }
              onRetry={() => void refetch()}
            />
          ) : restaurants.length === 0 ? (
            <EmptyState
              title="No matching kitchens"
              description="Try clearing your search or turning off the Open Now filter."
            />
          ) : (
            restaurants.map((restaurant) => (
              <RestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                onPress={() => router.push(`/restaurant/${restaurant.id}`)}
              />
            ))
          )}
        </ScrollView>

        <FloatingCartBar />
      </View>
    </SafeAreaView>
  );
}
