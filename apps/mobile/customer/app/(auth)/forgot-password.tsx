import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { router } from "expo-router";
import { AccountHeader } from "../../components/AccountHeader";
import { Button } from "../../components/Button";
import { MailIcon } from "../../components/Icons";
import { InputField } from "../../components/InputField";
import { ApiClientError } from "../../services/api";
import { authService } from "../../services/authService";

const forgotSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});

type ForgotFormValues = z.infer<typeof forgotSchema>;

export default function CustomerForgotPasswordScreen() {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: ForgotFormValues) => {
    setServerError(null);
    const normalizedEmail = values.email.toLowerCase();
    try {
      const otpData = await authService.requestPasswordReset(normalizedEmail);
      router.push({
        pathname: "/(auth)/otp",
        params: {
          email: normalizedEmail,
          signedToken: otpData.signedToken,
          mode: "reset-password",
        },
      });
    } catch (err) {
      setServerError(
        err instanceof ApiClientError ? err.message : "Could not send password reset code."
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
              Forgot password
            </Text>
            <Text className="font-manrope text-[14px] leading-[22px] text-chovia-muted">
              Enter your registered email address and we’ll send a verification code.
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
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="Email address"
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  leadingIcon={<MailIcon size={20} />}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.email?.message}
                />
              )}
            />

            <Button label="Send code" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
