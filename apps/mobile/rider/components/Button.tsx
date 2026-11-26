import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, type StyleProp, type ViewStyle } from "react-native";
import { COLORS } from "../utils/theme";

export type ButtonVariant = "primary" | "secondary" | "text";

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  style,
  testID,
}) => {
  const isDisabled = disabled || loading;

  const containerClass =
    variant === "primary"
      ? isDisabled
        ? "bg-chovia-dotInactive"
        : "bg-chovia-green"
      : variant === "secondary"
        ? "bg-chovia-card border border-chovia-green"
        : "bg-transparent";

  const textClass =
    variant === "primary"
      ? isDisabled
        ? "text-chovia-muted"
        : "text-chovia-card"
      : isDisabled
        ? "text-chovia-dotInactive"
        : "text-chovia-green";

  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.8}
      disabled={isDisabled}
      onPress={onPress}
      className={`h-[44px] w-full flex-row items-center justify-center rounded-full px-4 ${containerClass}`}
      style={style}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" ? COLORS.white : COLORS.primary}
        />
      ) : (
        <Text className={`font-manrope-medium text-[14px] leading-[20px] ${textClass}`}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
};
