import React, { useMemo, useState } from "react";
import {
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { FloatingCartBar } from "../../components/FloatingCartBar";
import { BellIcon, ChevronRightIcon, PinIcon, SearchIcon } from "../../components/Icons";
import { RestaurantCard } from "../../components/RestaurantCard";
import { EmptyState, ErrorState, LoadingView } from "../../components/StateViews";
import { useAddresses, useNotifications, useRestaurants } from "../../hooks/useCustomerQueries";
import { ApiClientError } from "../../services/api";
import { useAuthStore } from "../../store/useAuthStore";
import { useLocationStore } from "../../store/useLocationStore";
import { COLORS } from "../../utils/theme";
import catAfrican from "../../assets/images/cat_african.png";
import catAsian from "../../assets/images/cat_asian.png";
import catBuka from "../../assets/images/cat_buka.png";
import catLocal from "../../assets/images/cat_local.png";

const CUISINE_FILTERS = [
  { id: "all", label: "All", query: "", image: catLocal },
  { id: "african", label: "African", query: "African", image: catAfrican },
  { id: "buka", label: "Buka", query: "Buka", image: catBuka },
  { id: "asian", label: "Asian", query: "Asian", image: catAsian },
] as const;

export default function CustomerHomeScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const selectedAddressId = useLocationStore((s) => s.selectedAddressId);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const { data: addresses } = useAddresses();
  const { data: notifications } = useNotifications();

  const activeAddress = useMemo(() => {
    if (!addresses || addresses.length === 0) return null;
    if (selectedAddressId) {
      const match = addresses.find((a) => a.id === selectedAddressId);
      if (match) return match;
    }
    return addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
  }, [addresses, selectedAddressId]);

  const effectiveSearch = useMemo(() => {
    const trimmed = searchQuery.trim();
    if (trimmed) return trimmed;
    const cat = CUISINE_FILTERS.find((c) => c.id === activeCategory);
    return cat?.query || undefined;
  }, [searchQuery, activeCategory]);

  const {
    data: restaurantsData,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useRestaurants({
    search: effectiveSearch,
    latitude: activeAddress?.latitude,
    longitude: activeAddress?.longitude,
    radiusKm: 25,
    limit: 20,
  });

  const unreadCount = useMemo(
    () => (notifications ? notifications.filter((n) => !n.isRead).length : 0),
    [notifications]
  );

  const restaurants = restaurantsData?.items ?? [];

  return (
    <SafeAreaView className="flex-1 bg-chovia-background" edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <View className="flex-1 bg-chovia-background">
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pb-6 pt-2"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor={COLORS.primary}
            />
          }
        >
          {/* Top Delivery Address & Notification Bar */}
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() =>
                router.push(isAuthenticated ? "/profile/addresses" : "/(auth)/login")
              }
              activeOpacity={0.75}
              className="flex-1 flex-row items-center gap-3 pr-3"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-chovia-card">
                <PinIcon size={20} color={COLORS.primary} />
              </View>
              <View className="flex-1">
                <Text className="font-manrope text-[12px] text-chovia-subtle">
                  Delivering to
                </Text>
                <View className="flex-row items-center gap-1">
                  <Text
                    numberOfLines={1}
                    className="flex-shrink font-manrope-semibold text-[14px] text-chovia-deep"
                  >
                    {activeAddress
                      ? `${activeAddress.label} • ${activeAddress.addressText}`
                      : isAuthenticated
                        ? "Add delivery address"
                        : "Sign in to set address"}
                  </Text>
                  <ChevronRightIcon size={16} color={COLORS.deep} />
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() =>
                router.push(isAuthenticated ? "/profile/notifications" : "/(auth)/login")
              }
              activeOpacity={0.75}
              className="relative h-10 w-10 items-center justify-center rounded-full bg-chovia-card"
              accessibilityLabel="Notifications"
            >
              <BellIcon size={20} color={COLORS.deep} />
              {unreadCount > 0 && (
                <View className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-chovia-error" />
              )}
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View className="mt-5 h-[46px] flex-row items-center gap-2.5 rounded-[14px] border border-[#E2EBE6] bg-chovia-card px-3.5">
            <SearchIcon size={18} color={COLORS.subtle} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search restaurants or cuisines..."
              placeholderTextColor={COLORS.subtle}
              returnKeyType="search"
              className="flex-1 font-manrope text-[14px] text-chovia-deep"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Text className="font-manrope-medium text-[12px] text-chovia-green">Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Category Strip */}
          <View className="mt-6 flex-row justify-between">
            {CUISINE_FILTERS.map((cat) => {
              const isSelected = activeCategory === cat.id && !searchQuery.trim();
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => {
                    setSearchQuery("");
                    setActiveCategory(cat.id);
                  }}
                  activeOpacity={0.8}
                  className={`w-[23%] items-center rounded-[14px] py-2.5 ${
                    isSelected
                      ? "border border-chovia-green bg-emerald-50"
                      : "bg-chovia-card"
                  }`}
                >
                  <Image
                    source={cat.image}
                    className="h-7 w-7 rounded-[8px]"
                    resizeMode="cover"
                  />
                  <Text
                    className={`mt-1.5 font-manrope-medium text-[12px] ${
                      isSelected ? "text-chovia-green" : "text-chovia-deep"
                    }`}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Restaurants Section */}
          <View className="mt-6 flex-row items-center justify-between">
            <Text className="font-manrope-semibold text-[16px] text-chovia-deep">
              Explore Restaurants
            </Text>
            <TouchableOpacity
              onPress={() => {
                setSearchQuery("");
                setActiveCategory("all");
              }}
            >
              <Text className="font-manrope-semibold text-[14px] text-chovia-green">See All</Text>
            </TouchableOpacity>
          </View>

          <View className="mt-4">
            {isLoading ? (
              <LoadingView label="Finding nearby restaurants..." />
            ) : isError ? (
              <ErrorState
                message={
                  error instanceof ApiClientError
                    ? error.message
                    : "Unable to load restaurants right now."
                }
                onRetry={() => void refetch()}
              />
            ) : restaurants.length === 0 ? (
              <EmptyState
                title="No restaurants found"
                description={
                  effectiveSearch
                    ? `No active kitchens matched "${effectiveSearch}".`
                    : "No active restaurants are currently available in this area."
                }
                actionLabel={effectiveSearch ? "Reset filters" : undefined}
                onAction={
                  effectiveSearch
                    ? () => {
                        setSearchQuery("");
                        setActiveCategory("all");
                      }
                    : undefined
                }
              />
            ) : (
              <View className="flex-row flex-wrap justify-between gap-y-3.5">
                {restaurants.map((restaurant) => (
                  <RestaurantCard
                    key={restaurant.id}
                    restaurant={restaurant}
                    compact
                    onPress={() => router.push(`/restaurant/${restaurant.id}`)}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        <FloatingCartBar />
      </View>
    </SafeAreaView>
  );
}
