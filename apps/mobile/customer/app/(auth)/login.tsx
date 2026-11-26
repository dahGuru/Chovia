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
import { router } from "expo-router";
import { AccountHeader } from "../../components/AccountHeader";
import { Button } from "../../components/Button";
import { LockIcon, MailIcon } from "../../components/Icons";
import { InputField } from "../../components/InputField";
import { ApiClientError } from "../../services/api";
import { authService } from "../../services/authService";
import { useAuthStore } from "../../store/useAuthStore";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function CustomerLoginScreen() {
  const login = useAuthStore((s) => s.login);
  const [serverError, setServerError] = useState<string | null>(null);
  const [needsVerificationEmail, setNeedsVerificationEmail] = useState<string | null>(null);
  const [resendingOtp, setResendingOtp] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    setNeedsVerificationEmail(null);
    try {
      await login({
        email: values.email.toLowerCase(),
        password: values.password,
        deviceInfo: {
          deviceType:
            Platform.OS === "ios" ? "IOS" : Platform.OS === "android" ? "ANDROID" : "WEB",
        },
      });
      router.replace("/(tabs)");
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError(err.message);
        if (err.message.toLowerCase().includes("verify")) {
          setNeedsVerificationEmail(values.email.toLowerCase());
        }
      } else {
        setServerError("Unable to sign in. Please try again.");
      }
    }
  };

  const handleVerifyEmail = async () => {
    if (!needsVerificationEmail) return;
    setResendingOtp(true);
    try {
      const otpData = await authService.requestEmailVerification(needsVerificationEmail);
      router.push({
        pathname: "/(auth)/otp",
        params: {
          email: needsVerificationEmail,
          signedToken: otpData.signedToken,
          mode: "verify-email",
        },
      });
    } catch (err) {
      setServerError(
        err instanceof ApiClientError ? err.message : "Could not send verification code."
      );
    } finally {
      setResendingOtp(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-chovia-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <AccountHeader onBack={() => router.replace("/(auth)/onboarding")} />
        <ScrollView
          className="flex-1 px-5"
          contentContainerClassName="pb-10"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-3">
            <Text className="font-manrope-semibold text-[28px] leading-[34px] text-chovia-deep">
              Welcome back
            </Text>
            <Text className="font-manrope text-[14px] leading-[22px] text-chovia-muted">
              Log in for your next delicious delivery.
            </Text>
          </View>

          {serverError && (
            <View className="mt-5 rounded-[12px] border border-red-200 bg-red-50 p-3.5">
              <Text className="font-manrope-medium text-[13px] text-chovia-error">
                {serverError}
              </Text>
              {needsVerificationEmail && (
                <TouchableOpacity
                  onPress={handleVerifyEmail}
                  disabled={resendingOtp}
                  className="mt-2"
                >
                  <Text className="font-manrope-semibold text-[13px] text-chovia-green underline">
                    {resendingOtp ? "Sending code..." : "Verify email address now"}
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
                  autoComplete="email"
                  leadingIcon={<MailIcon size={20} />}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.email?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="Password"
                  placeholder="Enter your password"
                  isPassword
                  autoCapitalize="none"
                  leadingIcon={<LockIcon size={20} />}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                />
              )}
            />

            <View className="flex-row items-center justify-between">
              <TouchableOpacity
                onPress={() => router.push("/(auth)/verify-email")}
                activeOpacity={0.7}
              >
                <Text className="font-manrope-medium text-[14px] text-chovia-green">
                  Verify email
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/(auth)/forgot-password")}
                activeOpacity={0.7}
              >
                <Text className="font-manrope-medium text-[14px] text-chovia-green">
                  Forgot password?
                </Text>
              </TouchableOpacity>
            </View>

            <View className="mt-2">
              <Button label="Log in" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
            </View>
          </View>

          <View className="mt-8 flex-row items-center justify-center gap-1.5">
            <Text className="font-manrope text-[14px] text-chovia-muted">
              Don’t have an account?
            </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/register")} activeOpacity={0.7}>
              <Text className="font-manrope-semibold text-[14px] text-chovia-green">Sign up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
