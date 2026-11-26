import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { COLORS } from "../utils/theme";
import { Button } from "./Button";

export const LoadingView: React.FC<{ label?: string | undefined }> = ({
  label = "Loading...",
}) => (
  <View className="flex-1 items-center justify-center bg-chovia-background px-6 py-12">
    <ActivityIndicator size="large" color={COLORS.primary} />
    <Text className="mt-3 font-manrope text-[14px] text-chovia-muted">{label}</Text>
  </View>
);

export const EmptyState: React.FC<{
  title: string;
  description: string;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
}> = ({ title, description, actionLabel, onAction }) => (
  <View className="items-center justify-center rounded-[16px] bg-chovia-card p-6">
    <Text className="text-center font-manrope-semibold text-[16px] text-chovia-deep">{title}</Text>
    <Text className="mt-1.5 text-center font-manrope text-[14px] leading-[20px] text-chovia-muted">
      {description}
    </Text>
    {actionLabel && onAction && (
      <View className="mt-4 w-full">
        <Button label={actionLabel} onPress={onAction} variant="secondary" />
      </View>
    )}
  </View>
);

export const ErrorState: React.FC<{
  message: string;
  onRetry?: (() => void) | undefined;
}> = ({ message, onRetry }) => (
  <View className="items-center justify-center rounded-[16px] border border-red-200 bg-red-50 p-5">
    <Text className="text-center font-manrope-semibold text-[15px] text-chovia-error">
      Something went wrong
    </Text>
    <Text className="mt-1 text-center font-manrope text-[13px] text-chovia-muted">{message}</Text>
    {onRetry && (
      <View className="mt-4 w-full">
        <Button label="Try again" onPress={onRetry} variant="secondary" />
      </View>
    )}
  </View>
);
