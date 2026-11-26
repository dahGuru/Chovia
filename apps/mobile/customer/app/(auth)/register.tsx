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
import { AUTH_CONSTRAINTS, normalizeNigerianPhone } from "../../utils/validation";
import { AccountHeader } from "../../components/AccountHeader";
import { Button } from "../../components/Button";
import { LockIcon, MailIcon, PhoneIcon, UserIcon } from "../../components/Icons";
import { InputField } from "../../components/InputField";
import { ApiClientError } from "../../services/api";
import { authService } from "../../services/authService";

const registerSchema = z.object({
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
          message: "Enter a valid Nigerian number (e.g. 08054093095) or E.164 number (+2348054093095)",
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
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function CustomerRegisterScreen() {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: "",
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setServerError(null);
    try {
      const normalizedEmail = values.email.toLowerCase();
      const response = await authService.register({
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
        },
      });
    } catch (err) {
      setServerError(
        err instanceof ApiClientError ? err.message : "Registration failed. Please try again."
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
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-3">
            <Text className="font-manrope-semibold text-[28px] leading-[34px] text-chovia-deep">
              Create your account
            </Text>
            <Text className="font-manrope text-[14px] leading-[22px] text-chovia-muted">
              Sign up to order fresh meals from kitchens near you.
            </Text>
          </View>

          {serverError && (
            <View className="mt-5 rounded-[12px] border border-red-200 bg-red-50 p-3.5">
              <Text className="font-manrope-medium text-[13px] text-chovia-error">
                {serverError}
              </Text>
            </View>
          )}

          <View className="mt-6 gap-4">
            <Controller
              control={control}
              name="firstName"
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="First name"
                  placeholder="Enter your first name"
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
                  placeholder="Enter your last name"
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
                  placeholder="Min. 8 chars, upper, lower & number"
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

            <View className="mt-2">
              <Button
                label="Create account"
                onPress={handleSubmit(onSubmit)}
                loading={isSubmitting}
              />
            </View>
          </View>

          <View className="mt-7 flex-row items-center justify-center gap-1.5">
            <Text className="font-manrope text-[14px] text-chovia-muted">
              Already have an account?
            </Text>
            <TouchableOpacity onPress={() => router.replace("/(auth)/login")} activeOpacity={0.7}>
              <Text className="font-manrope-semibold text-[14px] text-chovia-green">Log in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
