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
import { AccountHeader } from "../../components/AccountHeader";
import { Button } from "../../components/Button";
import { MailIcon } from "../../components/Icons";
import { InputField } from "../../components/InputField";
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

export default function CustomerVerifyEmailRecoveryScreen() {
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
        setInfoNotice("Your email address is already verified. You can log in now.");
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
              Verify your email
            </Text>
            <Text className="font-manrope text-[14px] leading-[22px] text-chovia-muted">
              Lost your verification screen? Enter your account email to receive a new 6-digit code.
            </Text>
          </View>

          {serverError && (
            <View className="mt-5 rounded-[12px] border border-red-200 bg-red-50 p-3.5">
              <Text className="font-manrope-medium text-[13px] text-chovia-error">
                {serverError}
              </Text>
            </View>
          )}

          {infoNotice && (
            <View className="mt-5 gap-2 rounded-[12px] border border-emerald-200 bg-emerald-50 p-3.5">
              <Text className="font-manrope-medium text-[13px] text-chovia-green">{infoNotice}</Text>
              {isAlreadyVerified && (
                <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
                  <Text className="font-manrope-semibold text-[13px] text-chovia-green underline">
                    Go to Log in
                  </Text>
                </TouchableOpacity>
              )}
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

            <Button
              label="Send verification code"
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting}
            />
          </View>

          <View className="mt-7 flex-row items-center justify-center gap-1.5">
            <Text className="font-manrope text-[14px] text-chovia-muted">Already verified?</Text>
            <TouchableOpacity onPress={() => router.replace("/(auth)/login")} activeOpacity={0.7}>
              <Text className="font-manrope-semibold text-[14px] text-chovia-green">Log in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
