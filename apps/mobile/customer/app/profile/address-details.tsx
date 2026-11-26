import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { router } from "expo-router";
import { GEOSPATIAL_CONSTRAINTS } from "../../utils/validation";
import { ScreenHeader } from "../../components/AccountHeader";
import { Button } from "../../components/Button";
import { PinIcon } from "../../components/Icons";
import { InputField } from "../../components/InputField";
import { useCreateAddress } from "../../hooks/useCustomerQueries";
import { ApiClientError } from "../../services/api";
import { useLocationStore } from "../../store/useLocationStore";

const addressSchema = z.object({
  label: z.string().trim().min(1, "Label is required (e.g. Home, Work)").max(50),
  addressText: z.string().trim().min(5, "Enter full street address").max(255),
  latitude: z.coerce
    .number()
    .min(GEOSPATIAL_CONSTRAINTS.latitude.min)
    .max(GEOSPATIAL_CONSTRAINTS.latitude.max),
  longitude: z.coerce
    .number()
    .min(GEOSPATIAL_CONSTRAINTS.longitude.min)
    .max(GEOSPATIAL_CONSTRAINTS.longitude.max),
});

type AddressFormValues = z.infer<typeof addressSchema>;

export default function CustomerAddressDetailsScreen() {
  const createAddress = useCreateAddress();
  const setSelectedAddressId = useLocationStore((s) => s.setSelectedAddressId);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      label: "Home",
      addressText: "",
      latitude: 6.7429,
      longitude: 6.1356,
    },
  });

  const onSubmit = async (values: AddressFormValues) => {
    setErrorMsg(null);
    try {
      const created = await createAddress.mutateAsync({
        ...values,
        isDefault: true,
      });
      setSelectedAddressId(created.id);
      router.back();
    } catch (err) {
      setErrorMsg(err instanceof ApiClientError ? err.message : "Failed to save address.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-chovia-background" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScreenHeader title="Add Delivery Address" />
        <ScrollView className="flex-1 px-5" contentContainerClassName="pt-4 pb-8 gap-4">
          {errorMsg && (
            <View className="rounded-[12px] border border-red-200 bg-red-50 p-3">
              <Text className="font-manrope text-[13px] text-chovia-error">{errorMsg}</Text>
            </View>
          )}

          <Controller
            control={control}
            name="label"
            render={({ field: { onChange, onBlur, value } }) => (
              <InputField
                label="Address Label"
                placeholder="Home, Office, Hostel..."
                leadingIcon={<PinIcon size={18} />}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.label?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="addressText"
            render={({ field: { onChange, onBlur, value } }) => (
              <InputField
                label="Street Address"
                placeholder="14 Market Road, Ekpoma"
                leadingIcon={<PinIcon size={18} />}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.addressText?.message}
              />
            )}
          />

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Controller
                control={control}
                name="latitude"
                render={({ field: { onChange, onBlur, value } }) => (
                  <InputField
                    label="Latitude"
                    keyboardType="numeric"
                    value={String(value)}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.latitude?.message}
                  />
                )}
              />
            </View>
            <View className="flex-1">
              <Controller
                control={control}
                name="longitude"
                render={({ field: { onChange, onBlur, value } }) => (
                  <InputField
                    label="Longitude"
                    keyboardType="numeric"
                    value={String(value)}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.longitude?.message}
                  />
                )}
              />
            </View>
          </View>

          <View className="mt-4">
            <Button
              label="Save Address"
              onPress={handleSubmit(onSubmit)}
              loading={createAddress.isPending}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
