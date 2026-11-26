import React, { useEffect, useState } from "react";
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
import { AUTH_CONSTRAINTS } from "../../utils/validation";
import { AccountHeader } from "../../components/AccountHeader";
import { Button } from "../../components/Button";
import { LockIcon } from "../../components/Icons";
import { InputField } from "../../components/InputField";
import { ApiClientError } from "../../services/api";
import { authService } from "../../services/authService";

const otpSchema = z.object({
  otp: z.string().trim().regex(AUTH_CONSTRAINTS.otp.pattern, "Enter the 6-digit code"),
});

type OtpFormValues = z.infer<typeof otpSchema>;

export default function CustomerOtpScreen() {
  const params = useLocalSearchParams<{
    email?: string;
    signedToken?: string;
    mode?: string;
  }>();

  const email = (params.email ?? "").toLowerCase();
  const mode = params.mode === "reset-password" ? "reset-password" : "verify-email";
  const [signedToken, setSignedToken] = useState(params.signedToken ?? "");
  const [serverError, setServerError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(45);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  });

  const onSubmit = async (values: OtpFormValues) => {
    setServerError(null);
    setSuccessNotice(null);

    if (!email || !signedToken) {
      setServerError("Verification session expired. Please request a new code.");
      return;
    }

    try {
      if (mode === "verify-email") {
        await authService.verifyEmail({ email, otp: values.otp, signedToken });
        router.replace("/(auth)/login");
      } else {
        const res = await authService.verifyPasswordReset({ email, otp: values.otp, signedToken });
        router.replace({
          pathname: "/(auth)/reset-password",
          params: { email, resetToken: res.resetToken },
        });
      }
    } catch (err) {
      setServerError(
        err instanceof ApiClientError ? err.message : "Invalid or expired verification code."
      );
    }
  };

  const handleResend = async () => {
    if (!email || cooldown > 0 || resending) return;
    setResending(true);
    setServerError(null);
    try {
      const res =
        mode === "verify-email"
          ? await authService.requestEmailVerification(email)
          : await authService.requestPasswordReset(email);
      setSignedToken(res.signedToken);
      setCooldown(45);
      setSuccessNotice("A new 6-digit code has been sent to your email.");
    } catch (err) {
      setServerError(err instanceof ApiClientError ? err.message : "Failed to resend code.");
    } finally {
      setResending(false);
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
              Enter the 6-digit verification code sent to{" "}
              <Text className="font-manrope-semibold text-chovia-deep">{email || "your email"}</Text>.
            </Text>
          </View>

          {serverError && (
            <View className="mt-5 rounded-[12px] border border-red-200 bg-red-50 p-3.5">
              <Text className="font-manrope-medium text-[13px] text-chovia-error">
                {serverError}
              </Text>
            </View>
          )}

          {successNotice && (
            <View className="mt-5 rounded-[12px] border border-emerald-200 bg-emerald-50 p-3.5">
              <Text className="font-manrope-medium text-[13px] text-chovia-green">
                {successNotice}
              </Text>
            </View>
          )}

          <View className="mt-7 gap-5">
            <Controller
              control={control}
              name="otp"
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="6-digit code"
                  placeholder="000000"
                  keyboardType="number-pad"
                  maxLength={6}
                  leadingIcon={<LockIcon size={20} />}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.otp?.message}
                />
              )}
            />

            <Button label="Verify code" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
          </View>

          <View className="mt-6 flex-row items-center justify-center gap-1.5">
            <Text className="font-manrope text-[14px] text-chovia-muted">Didn’t receive it?</Text>
            <TouchableOpacity
              onPress={handleResend}
              disabled={cooldown > 0 || resending}
              activeOpacity={0.7}
            >
              <Text
                className={`font-manrope-semibold text-[14px] ${
                  cooldown > 0 ? "text-chovia-subtle" : "text-chovia-green"
                }`}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? "Sending..." : "Resend code"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
