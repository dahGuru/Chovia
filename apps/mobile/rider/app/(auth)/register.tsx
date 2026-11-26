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
import { Button } from "../../components/Button";
import { LockIcon, MailIcon, PhoneIcon, UserIcon } from "../../components/Icons";
import { InputField } from "../../components/InputField";
import { RiderHeader } from "../../components/RiderHeader";
import { ApiClientError } from "../../services/api";
import { authService } from "../../services/authService";
import { AUTH_CONSTRAINTS, normalizeNigerianPhone } from "../../utils/validation";

const riderRegisterSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required").max(100),
    lastName: z.string().trim().min(1, "Last name is required").max(100),
    email: z
      .string()
      .trim()
      .email("Enter a valid email address")
      .max(AUTH_CONSTRAINTS.email.maxLength),
    phone: z
      .string()
      .trim()
      .transform((val, ctx) => {
        const normalized = normalizeNigerianPhone(val);
        if (!normalized || !AUTH_CONSTRAINTS.phone.pattern.test(normalized)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Enter a valid Nigerian number (e.g. 08054093095) or E.164 number (+2348054093095)",
          });
          return z.NEVER;
        }
        return normalized;
      }),
    password: z
      .string()
      .min(AUTH_CONSTRAINTS.password.minLength, AUTH_CONSTRAINTS.password.message)
      .max(AUTH_CONSTRAINTS.password.maxLength)
      .regex(AUTH_CONSTRAINTS.password.pattern, AUTH_CONSTRAINTS.password.message),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RiderRegisterValues = z.infer<typeof riderRegisterSchema>;

export default function RiderRegisterScreen() {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RiderRegisterValues>({
    resolver: zodResolver(riderRegisterSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: RiderRegisterValues) => {
    setServerError(null);
    try {
      const normalizedEmail = values.email.toLowerCase();
      const response = await authService.registerRider({
        firstName: values.firstName,
        lastName: values.lastName,
        email: normalizedEmail,
        phone: values.phone,
        password: values.password,
      });

      router.push({
        pathname: "/(auth)/otp",
        params: {
          email: normalizedEmail,
          signedToken: response.otpData.signedToken,
          mode: "verify-email",
          emailDeliveryStatus: response.emailDeliveryStatus,
        },
      });
    } catch (err) {
      setServerError(
        err instanceof ApiClientError ? err.message : "Rider registration failed. Please try again."
      );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-chovia-background" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <RiderHeader title="Become a Rider" />
        <ScrollView
          className="flex-1 px-5"
          contentContainerClassName="pt-2 pb-10 gap-4"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-2">
            <Text className="font-manrope-semibold text-[26px] leading-[34px] text-chovia-deep">
              Create your rider account
            </Text>
            <Text className="font-manrope text-[14px] leading-[20px] text-chovia-muted">
              Register your account first, verify your email, and then complete your KYC documents.
            </Text>
          </View>

          {serverError && (
            <View className="rounded-[12px] border border-red-200 bg-red-50 p-3.5">
              <Text className="font-manrope-medium text-[13px] text-chovia-error">
                {serverError}
              </Text>
            </View>
          )}

          <Controller
            control={control}
            name="firstName"
            render={({ field: { onChange, onBlur, value } }) => (
              <InputField
                label="First name"
                placeholder="Daniel"
                leadingIcon={<UserIcon size={20} />}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.firstName?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="lastName"
            render={({ field: { onChange, onBlur, value } }) => (
              <InputField
                label="Last name"
                placeholder="Okafor"
                leadingIcon={<UserIcon size={20} />}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.lastName?.message}
              />
            )}
          />

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
            name="phone"
            render={({ field: { onChange, onBlur, value } }) => (
              <InputField
                label="Phone number"
                placeholder="08054093095 or +2348054093095"
                keyboardType="phone-pad"
                leadingIcon={<PhoneIcon size={20} />}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.phone?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <InputField
                label="Password"
                placeholder="Create a strong password"
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

          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <InputField
                label="Confirm password"
                placeholder="Re-enter your password"
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
              label="Continue to verification"
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
              Already have a rider account?{" "}
              <Text className="font-manrope-semibold text-chovia-green">Log in</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
