import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { router, useLocalSearchParams } from "expo-router";
import { Button } from "../../components/Button";
import { LockIcon } from "../../components/Icons";
import { InputField } from "../../components/InputField";
import { RiderHeader } from "../../components/RiderHeader";
import { ApiClientError } from "../../services/api";
import { authService } from "../../services/authService";
import { AUTH_CONSTRAINTS } from "../../utils/validation";

const resetSchema = z
  .object({
    newPassword: z
      .string()
      .min(AUTH_CONSTRAINTS.password.minLength, AUTH_CONSTRAINTS.password.message)
      .max(AUTH_CONSTRAINTS.password.maxLength)
      .regex(AUTH_CONSTRAINTS.password.pattern, AUTH_CONSTRAINTS.password.message),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetValues = z.infer<typeof resetSchema>;

export default function RiderResetPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string; resetToken?: string }>();
  const email = (params.email ?? "").toLowerCase();
  const resetToken = params.resetToken ?? "";
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const onSubmit = async (values: ResetValues) => {
    setServerError(null);
    if (!email || !resetToken) {
      setServerError("Reset session expired. Please restart password recovery.");
      return;
    }
    try {
      await authService.completePasswordReset({
        email,
        resetToken,
        newPassword: values.newPassword,
      });
      router.replace("/(auth)/login");
    } catch (err) {
      setServerError(
        err instanceof ApiClientError ? err.message : "Failed to update password."
      );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-chovia-background" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <RiderHeader title="Reset password" />
        <ScrollView
          className="flex-1 px-5"
          contentContainerClassName="pt-4 pb-10 gap-4"
          keyboardShouldPersistTaps="handled"
        >
          <Text className="font-manrope-semibold text-[26px] text-chovia-deep">
            Create new password
          </Text>

          {serverError && (
            <View className="rounded-[12px] border border-red-200 bg-red-50 p-3.5">
              <Text className="font-manrope-medium text-[13px] text-chovia-error">
                {serverError}
              </Text>
            </View>
          )}

          <Controller
            control={control}
            name="newPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <InputField
                label="New password"
                placeholder="Min. 8 chars, upper, lower & number"
                isPassword
                autoCapitalize="none"
                leadingIcon={<LockIcon size={20} />}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.newPassword?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <InputField
                label="Confirm password"
                placeholder="Re-enter your new password"
                isPassword
                autoCapitalize="none"
                leadingIcon={<LockIcon size={20} />}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.confirmPassword?.message}
              />
            )}
          />

          <View className="mt-2">
            <Button
              label="Update password"
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
