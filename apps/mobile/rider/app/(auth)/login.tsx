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
import { LockIcon, MailIcon } from "../../components/Icons";
import { InputField } from "../../components/InputField";
import { RiderHeader } from "../../components/RiderHeader";
import { ApiClientError } from "../../services/api";
import { authService } from "../../services/authService";
import { riderDeliveryService } from "../../services/riderDeliveryService";
import { useAuthStore } from "../../store/useAuthStore";

const riderLoginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type RiderLoginFormValues = z.infer<typeof riderLoginSchema>;

export default function RiderLoginScreen() {
  const params = useLocalSearchParams<{ verifiedEmail?: string }>();
  const login = useAuthStore((s) => s.login);
  const [serverError, setServerError] = useState<string | null>(null);
  const [needsVerificationEmail, setNeedsVerificationEmail] = useState<string | null>(null);
  const [resendingOtp, setResendingOtp] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RiderLoginFormValues>({
    resolver: zodResolver(riderLoginSchema),
    defaultValues: { email: params.verifiedEmail ?? "", password: "" },
  });

  const onSubmit = async (values: RiderLoginFormValues) => {
    setServerError(null);
    setNeedsVerificationEmail(null);
    const normalizedEmail = values.email.toLowerCase();
    try {
      await login({
        email: normalizedEmail,
        password: values.password,
        deviceInfo: {
          deviceType:
            Platform.OS === "ios" ? "IOS" : Platform.OS === "android" ? "ANDROID" : "WEB",
        },
      });

      try {
        const profile = await riderDeliveryService.getMyProfile();
        if (profile.status === "ACTIVE") {
          router.replace("/(tabs)");
        } else if (profile.kycStatus === "NOT_SUBMITTED") {
          router.replace("/(auth)/kyc");
        } else {
          router.replace("/(auth)/application-status");
        }
      } catch {
        router.replace("/(tabs)");
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError(err.message);
        if (err.message.toLowerCase().includes("verify")) {
          setNeedsVerificationEmail(normalizedEmail);
        }
      } else {
        setServerError("Unable to sign in. Please try again.");
      }
    }
  };

  const handleVerifyEmail = async () => {
    if (!needsVerificationEmail || resendingOtp) return;
    setResendingOtp(true);
    try {
      const otpData = await authService.requestEmailVerification(needsVerificationEmail);
      if (otpData.signedToken) {
        router.push({
          pathname: "/(auth)/otp",
          params: {
            email: needsVerificationEmail,
            signedToken: otpData.signedToken,
            mode: "verify-email",
          },
        });
        return;
      }
      router.push({
        pathname: "/(auth)/verify-email",
        params: { email: needsVerificationEmail },
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
    <SafeAreaView className="flex-1 bg-chovia-background" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <RiderHeader title="Chovia Rider" onBack={() => router.replace("/(auth)/welcome")} />
        <ScrollView
          className="flex-1 px-5"
          contentContainerClassName="pb-10 pt-4 gap-4"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text className="font-manrope-semibold text-[28px] leading-[36px] text-chovia-deep">
            Welcome back
          </Text>
          <Text className="font-manrope text-[14px] leading-[20px] text-chovia-muted">
            Log in with your CHOVIA Rider account to submit KYC or go online.
          </Text>

          {params.verifiedEmail && (
            <View className="rounded-[12px] border border-emerald-200 bg-emerald-50 p-3.5">
              <Text className="font-manrope-medium text-[13px] text-chovia-green">
                Email verified! Sign in to continue your rider application.
              </Text>
            </View>
          )}

          {serverError && (
            <View className="rounded-[12px] border border-red-200 bg-red-50 p-3.5">
              <Text className="font-manrope-medium text-[13px] text-chovia-error">
                {serverError}
              </Text>
              {needsVerificationEmail && (
                <TouchableOpacity
                  onPress={() => void handleVerifyEmail()}
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
              <Text className="font-manrope-semibold text-[14px] text-chovia-green">
                Verify email
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/(auth)/forgot-password")}
              activeOpacity={0.7}
            >
              <Text className="font-manrope-semibold text-[14px] text-chovia-green">
                Forgot password?
              </Text>
            </TouchableOpacity>
          </View>

          <View className="mt-1">
            <Button label="Log in" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
          </View>

          <TouchableOpacity
            onPress={() => router.push("/(auth)/register")}
            activeOpacity={0.7}
            className="mt-2 self-center"
          >
            <Text className="font-manrope text-[14px] text-chovia-muted">
              New to Chovia?{" "}
              <Text className="font-manrope-semibold text-chovia-green">
                Apply to become a rider
              </Text>
            </Text>
          </TouchableOpacity>

          <View className="mt-2 gap-2 rounded-[16px] bg-chovia-card p-4">
            <Text className="font-manrope-semibold text-[15px] text-chovia-deep">
              Made for delivery partners
            </Text>
            <Text className="font-manrope text-[13px] leading-[19px] text-chovia-muted">
              Rider accounts must complete email verification and KYC approval before going online
              or accepting deliveries. Customer accounts cannot log into the Rider app.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
