import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { router } from "expo-router";
import { AUTH_CONSTRAINTS, normalizeNigerianPhone } from "../../utils/validation";
import { ScreenHeader } from "../../components/AccountHeader";
import { Button } from "../../components/Button";
import { PhoneIcon, UserIcon } from "../../components/Icons";
import { InputField } from "../../components/InputField";
import { useUpdateProfile } from "../../hooks/useCustomerQueries";
import { ApiClientError } from "../../services/api";
import { useAuthStore } from "../../store/useAuthStore";

const editProfileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  phone: z
    .string()
    .trim()
    .transform((val, ctx) => {
      const normalized = normalizeNigerianPhone(val);
      if (!normalized || !AUTH_CONSTRAINTS.phone.pattern.test(normalized)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a valid Nigerian number (e.g. 08054093095) or E.164 number (+2348054093095)",
        });
        return z.NEVER;
      }
      return normalized;
    }),
});

type EditProfileValues = z.infer<typeof editProfileSchema>;

export default function CustomerEditProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useUpdateProfile();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EditProfileValues>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      phone: user?.phone ?? "",
    },
  });

  const onSubmit = async (values: EditProfileValues) => {
    setErrorMsg(null);
    try {
      await updateProfile.mutateAsync(values);
      Alert.alert("Profile updated", "Your changes have been saved.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err) {
      setErrorMsg(
        err instanceof ApiClientError ? err.message : "Could not update your profile."
      );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-chovia-background" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScreenHeader title="Edit Profile" />
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
