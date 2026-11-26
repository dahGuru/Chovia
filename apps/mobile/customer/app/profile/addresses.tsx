import React from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ScreenHeader } from "../../components/AccountHeader";
import { Button } from "../../components/Button";
import { PinIcon } from "../../components/Icons";
import { EmptyState, ErrorState, LoadingView } from "../../components/StateViews";
import {
  useAddresses,
  useDeleteAddress,
  useSetDefaultAddress,
} from "../../hooks/useCustomerQueries";
import { ApiClientError } from "../../services/api";
import { useLocationStore } from "../../store/useLocationStore";
import { COLORS } from "../../utils/theme";

export default function CustomerAddressesScreen() {
  const selectedAddressId = useLocationStore((s) => s.selectedAddressId);
  const setSelectedAddressId = useLocationStore((s) => s.setSelectedAddressId);

  const { data: addresses, isLoading, isError, error, refetch } = useAddresses();
  const setDefaultAddress = useSetDefaultAddress();
  const deleteAddress = useDeleteAddress();

  const handleDelete = (id: string, label: string) => {
    Alert.alert("Remove address?", `Delete "${label}" from your saved addresses?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void deleteAddress.mutate(id);
          if (selectedAddressId === id) {
            setSelectedAddressId(null);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-chovia-background" edges={["top", "bottom"]}>
      <ScreenHeader title="Delivery Addresses" />

      <ScrollView className="flex-1 px-5" contentContainerClassName="pb-6 pt-3 gap-3">
        {isLoading ? (
          <LoadingView label="Loading saved addresses..." />
        ) : isError ? (
          <ErrorState
            message={
              error instanceof ApiClientError ? error.message : "Could not load addresses."
            }
            onRetry={() => void refetch()}
          />
        ) : !addresses || addresses.length === 0 ? (
          <EmptyState
            title="No saved addresses"
            description="Add a delivery address so we can calculate delivery fees and deliver to your door."
          />
        ) : (
          addresses.map((addr) => {
            const isActive = selectedAddressId ? selectedAddressId === addr.id : addr.isDefault;
            return (
              <TouchableOpacity
                key={addr.id}
                onPress={() => {
                  setSelectedAddressId(addr.id);
                  router.back();
                }}
                activeOpacity={0.85}
                className={`gap-2 rounded-[16px] border p-4 ${
                  isActive
                    ? "border-chovia-green bg-emerald-50/60"
                    : "border-transparent bg-chovia-card"
                }`}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <PinIcon size={18} color={COLORS.primary} />
                    <Text className="font-manrope-semibold text-[15px] text-chovia-deep">
                      {addr.label}
                    </Text>
                  </View>
                  {addr.isDefault && (
                    <View className="rounded-full bg-chovia-green px-2.5 py-0.5">
                      <Text className="font-manrope-medium text-[10px] text-white">Default</Text>
                    </View>
                  )}
                </View>

                <Text className="font-manrope text-[13px] leading-[19px] text-chovia-muted">
                  {addr.addressText}
                </Text>

                <View className="mt-1 flex-row items-center gap-4">
                  {!addr.isDefault && (
                    <TouchableOpacity
                      onPress={() => void setDefaultAddress.mutate(addr.id)}
                      disabled={setDefaultAddress.isPending}
                    >
                      <Text className="font-manrope-semibold text-[12px] text-chovia-green">
                        Set as default
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => handleDelete(addr.id, addr.label)}
                    disabled={deleteAddress.isPending}
                  >
                    <Text className="font-manrope-medium text-[12px] text-chovia-error">
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <View className="border-t border-chovia-border bg-chovia-card px-5 py-4">
        <Button
          label="Add New Address"
          onPress={() => router.push("/profile/address-details")}
        />
      </View>
    </SafeAreaView>
  );
}
