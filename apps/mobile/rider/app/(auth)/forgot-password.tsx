import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { router } from "expo-router";
import { Button } from "../../components/Button";
import { MailIcon } from "../../components/Icons";
import { InputField } from "../../components/InputField";
import { RiderHeader } from "../../components/RiderHeader";
import { ApiClientError } from "../../services/api";
import { authService } from "../../services/authService";

const forgotSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});

type ForgotValues = z.infer<typeof forgotSchema>;

export default function RiderForgotPasswordScreen() {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: ForgotValues) => {
    setServerError(null);
    const email = values.email.toLowerCase();
    try {
      const otpData = await authService.requestPasswordReset(email);
      router.push({
        pathname: "/(auth)/otp",
        params: { email, signedToken: otpData.signedToken },
      });
    } catch (err) {
      setServerError(
        err instanceof ApiClientError ? err.message : "Could not send reset verification code."
      );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-chovia-background" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <RiderHeader title="Forgot password" />
        <ScrollView
          className="flex-1 px-5"
          contentContainerClassName="pt-4 pb-10 gap-4"
          keyboardShouldPersistTaps="handled"
        >
          <Text className="font-manrope-semibold text-[26px] text-chovia-deep">
            Reset your password
          </Text>
          <Text className="font-manrope text-[14px] leading-[20px] text-chovia-muted">
            Enter your rider account email and we will send you a 6-digit verification code.
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
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <InputField
                label="Email address"
                placeholder="rider@chovia.app"
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

          <View className="mt-2">
            <Button label="Send code" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
