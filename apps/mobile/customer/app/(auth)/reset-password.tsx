import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { router, useLocalSearchParams } from "expo-router";
import { AUTH_CONSTRAINTS } from "../../utils/validation";
import { AccountHeader } from "../../components/AccountHeader";
import { Button } from "../../components/Button";
import { LockIcon } from "../../components/Icons";
import { InputField } from "../../components/InputField";
import { ApiClientError } from "../../services/api";
import { authService } from "../../services/authService";

const resetSchema = z
  .object({
    newPassword: z
      .string()
      .min(AUTH_CONSTRAINTS.password.minLength, AUTH_CONSTRAINTS.password.message)
      .max(AUTH_CONSTRAINTS.password.maxLength)
      .regex(AUTH_CONSTRAINTS.password.pattern, AUTH_CONSTRAINTS.password.message),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetFormValues = z.infer<typeof resetSchema>;

export default function CustomerResetPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string; resetToken?: string }>();
  const email = (params.email ?? "").toLowerCase();
  const resetToken = params.resetToken ?? "";
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const onSubmit = async (values: ResetFormValues) => {
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
        err instanceof ApiClientError ? err.message : "Failed to reset password. Please try again."
      );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-chovia-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <AccountHeader />
        <ScrollView
          className="flex-1 px-5"
          contentContainerClassName="pb-10"
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-3">
            <Text className="font-manrope-semibold text-[28px] leading-[34px] text-chovia-deep">
              Reset password
            </Text>
            <Text className="font-manrope text-[14px] leading-[22px] text-chovia-muted">
              Choose a strong new password for your CHOVIA account.
            </Text>
          </View>

          {serverError && (
            <View className="mt-5 rounded-[12px] border border-red-200 bg-red-50 p-3.5">
              <Text className="font-manrope-medium text-[13px] text-chovia-error">
                {serverError}
              </Text>
            </View>
          )}

          <View className="mt-7 gap-5">
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
