import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { router, useLocalSearchParams } from "expo-router";
import { Button } from "../../components/Button";
import { MailIcon } from "../../components/Icons";
import { InputField } from "../../components/InputField";
import { RiderHeader } from "../../components/RiderHeader";
import { ApiClientError } from "../../services/api";
import { authService } from "../../services/authService";
import { AUTH_CONSTRAINTS } from "../../utils/validation";

const verifyEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(AUTH_CONSTRAINTS.email.maxLength),
});

type VerifyEmailValues = z.infer<typeof verifyEmailSchema>;

export default function RiderVerifyEmailRecoveryScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [serverError, setServerError] = useState<string | null>(null);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);
  const [isAlreadyVerified, setIsAlreadyVerified] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyEmailValues>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { email: (params.email ?? "").toLowerCase() },
  });

  const onSubmit = async (values: VerifyEmailValues) => {
    setServerError(null);
    setInfoNotice(null);
    setIsAlreadyVerified(false);
    const normalizedEmail = values.email.toLowerCase();

    try {
      const otpData = await authService.requestEmailVerification(normalizedEmail);
      if (otpData.signedToken) {
        router.push({
          pathname: "/(auth)/otp",
          params: {
            email: normalizedEmail,
            signedToken: otpData.signedToken,
            mode: "verify-email",
          },
        });
        return;
      }

      if (otpData.message.toLowerCase().includes("already verified")) {
        setIsAlreadyVerified(true);
        setInfoNotice("Your rider email is already verified. You can log in now.");
      } else {
        setInfoNotice(otpData.message);
      }
    } catch (err) {
      setServerError(
        err instanceof ApiClientError
          ? err.message
          : "Could not send verification code. Please try again."
      );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-chovia-background" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <RiderHeader title="Verify Rider Email" />
        <ScrollView
          className="flex-1 px-5"
          contentContainerClassName="pt-4 pb-10 gap-4"
          keyboardShouldPersistTaps="handled"
        >
          <Text className="font-manrope-semibold text-[26px] text-chovia-deep">
            Recover email verification
          </Text>
          <Text className="font-manrope text-[14px] leading-[20px] text-chovia-muted">
            Enter the email address used for your CHOVIA Rider account to receive a fresh 6-digit
            verification code.
          </Text>

          {serverError && (
            <View className="rounded-[12px] border border-red-200 bg-red-50 p-3.5">
              <Text className="font-manrope-medium text-[13px] text-chovia-error">
                {serverError}
              </Text>
            </View>
          )}

          {infoNotice && (
            <View className="gap-2 rounded-[12px] border border-emerald-200 bg-emerald-50 p-3.5">
              <Text className="font-manrope-medium text-[13px] text-chovia-green">{infoNotice}</Text>
              {isAlreadyVerified && (
                <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
                  <Text className="font-manrope-semibold text-[13px] text-chovia-green underline">
                    Go to Rider Login
                  </Text>
                </TouchableOpacity>
              )}
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
            <Button
              label="Send verification code"
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting}
            />
          </View>

          <TouchableOpacity
            onPress={() => router.replace("/(auth)/login")}
            activeOpacity={0.7}
            className="self-center py-2"
          >
            <Text className="font-manrope text-[14px] text-chovia-muted">
              Already verified?{" "}
              <Text className="font-manrope-semibold text-chovia-green">Log in</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
