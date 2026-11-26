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
import { Button } from "../../components/Button";
import { LockIcon } from "../../components/Icons";
import { InputField } from "../../components/InputField";
import { RiderHeader } from "../../components/RiderHeader";
import { ApiClientError } from "../../services/api";
import { authService } from "../../services/authService";
import { AUTH_CONSTRAINTS } from "../../utils/validation";

const otpSchema = z.object({
  otp: z.string().trim().regex(AUTH_CONSTRAINTS.otp.pattern, "Enter the 6-digit code"),
});

type OtpValues = z.infer<typeof otpSchema>;

export default function RiderOtpScreen() {
  const params = useLocalSearchParams<{
    email?: string;
    signedToken?: string;
    mode?: string;
    emailDeliveryStatus?: string;
  }>();

  const email = (params.email ?? "").toLowerCase();
  const mode = params.mode === "verify-email" ? "verify-email" : "reset-password";
  const [signedToken, setSignedToken] = useState(params.signedToken ?? "");
  const [serverError, setServerError] = useState<string | null>(
    params.emailDeliveryStatus === "FAILED_RETRYABLE"
      ? "Your account was created, but sending the verification email failed. Tap Resend code below."
      : null
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(
    params.emailDeliveryStatus === "FAILED_RETRYABLE" ? 0 : 45
  );
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
  } = useForm<OtpValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  });

  const onSubmit = async (values: OtpValues) => {
    setServerError(null);
    setNotice(null);

    if (!email || !signedToken) {
      setServerError("Verification session expired. Please request a new code.");
      return;
    }

    try {
      if (mode === "verify-email") {
        await authService.verifyEmail({
          email,
          otp: values.otp,
          signedToken,
        });
        router.replace({
          pathname: "/(auth)/login",
          params: { verifiedEmail: email },
        });
      } else {
        const res = await authService.verifyPasswordReset({
          email,
          otp: values.otp,
          signedToken,
        });
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
    setNotice(null);
    try {
      const response =
        mode === "verify-email"
          ? await authService.requestEmailVerification(email)
          : await authService.requestPasswordReset(email);
      if (response.signedToken) {
        setSignedToken(response.signedToken);
        setNotice("A new 6-digit verification code has been sent to your email.");
        setCooldown(45);
      } else if (response.message.toLowerCase().includes("already verified")) {
        setNotice("Your rider email is already verified. You can log in now.");
      } else {
        setNotice(response.message);
      }
    } catch (err) {
      setServerError(
        err instanceof ApiClientError ? err.message : "Could not resend verification code."
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-chovia-background" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <RiderHeader title={mode === "verify-email" ? "Verify email" : "Verify code"} />
        <ScrollView
          className="flex-1 px-5"
          contentContainerClassName="pt-4 pb-10 gap-4"
          keyboardShouldPersistTaps="handled"
        >
          <Text className="font-manrope-semibold text-[26px] text-chovia-deep">
            {mode === "verify-email" ? "Verify your email address" : "Enter verification code"}
          </Text>
          <Text className="font-manrope text-[14px] leading-[20px] text-chovia-muted">
            Enter the 6-digit code sent to {email || "your email"}.
          </Text>

          {notice && (
            <View className="rounded-[12px] border border-emerald-200 bg-emerald-50 p-3.5">
              <Text className="font-manrope-medium text-[13px] text-chovia-green">{notice}</Text>
            </View>
          )}

          {serverError && (
            <View className="rounded-[12px] border border-red-200 bg-red-50 p-3.5">
              <Text className="font-manrope-medium text-[13px] text-chovia-error">
                {serverError}
              </Text>
            </View>
          )}

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

          <View className="mt-2">
            <Button label="Verify code" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
          </View>

          <View className="flex-row items-center justify-center pt-2">
            {cooldown > 0 ? (
              <Text className="font-manrope text-[13px] text-chovia-muted">
                Resend code in {cooldown}s
              </Text>
            ) : (
              <TouchableOpacity
                onPress={() => void handleResend()}
                disabled={resending}
                activeOpacity={0.7}
              >
                <Text className="font-manrope-semibold text-[14px] text-chovia-green">
                  {resending ? "Sending..." : "Resend verification code"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {mode === "verify-email" && (
            <TouchableOpacity
              onPress={() =>
                router.replace(
                  email
                    ? { pathname: "/(auth)/verify-email", params: { email } }
                    : "/(auth)/verify-email"
                )
              }
              activeOpacity={0.7}
              className="self-center pt-1"
            >
              <Text className="font-manrope-medium text-[13px] text-chovia-green">
                Lost your code or want to use another email?
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
