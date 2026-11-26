import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { router } from "expo-router";
import { Button } from "../../components/Button";
import { PhoneIcon, UserIcon } from "../../components/Icons";
import { InputField } from "../../components/InputField";
import { RiderHeader } from "../../components/RiderHeader";
import { useUpdateRiderProfile } from "../../hooks/useRiderQueries";
import { ApiClientError } from "../../services/api";
import { useAuthStore } from "../../store/useAuthStore";
import { AUTH_CONSTRAINTS } from "../../utils/validation";

const editSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  phone: z
    .string()
    .trim()
    .regex(AUTH_CONSTRAINTS.phone.pattern, AUTH_CONSTRAINTS.phone.message),
});

type EditValues = z.infer<typeof editSchema>;

export default function RiderEditProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useUpdateRiderProfile();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      phone: user?.phone ?? "",
    },
  });

  const onSubmit = async (values: EditValues) => {
    setErrorMsg(null);
    try {
      await updateProfile.mutateAsync(values);
      Alert.alert("Profile updated", "Your rider profile has been saved.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err) {
      setErrorMsg(err instanceof ApiClientError ? err.message : "Failed to update profile.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-chovia-background" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <RiderHeader title="Edit Profile" />
        <ScrollView className="flex-1 px-5" contentContainerClassName="pt-4 pb-8 gap-4">
          {errorMsg && (
            <View className="rounded-[12px] border border-red-200 bg-red-50 p-3">
              <Text className="font-manrope text-[13px] text-chovia-error">{errorMsg}</Text>
            </View>
          )}

          <Controller
            control={control}
            name="firstName"
            render={({ field: { onChange, onBlur, value } }) => (
              <InputField
                label="First name"
                leadingIcon={<UserIcon size={20} />}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.firstName?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="lastName"
            render={({ field: { onChange, onBlur, value } }) => (
              <InputField
                label="Last name"
                leadingIcon={<UserIcon size={20} />}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.lastName?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, onBlur, value } }) => (
              <InputField
                label="Phone number"
                keyboardType="phone-pad"
                leadingIcon={<PhoneIcon size={20} />}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.phone?.message}
              />
            )}
          />

          <View className="mt-4">
            <Button
              label="Save Changes"
              onPress={handleSubmit(onSubmit)}
              loading={updateProfile.isPending}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
