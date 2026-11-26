import React, { useState } from "react";
import { Text, TextInput, TouchableOpacity, View, type TextInputProps } from "react-native";
import { COLORS } from "../utils/theme";
import { EyeIcon } from "./Icons";

export interface InputFieldProps extends Omit<TextInputProps, "style"> {
  label: string;
  error?: string | undefined;
  leadingIcon?: React.ReactNode | undefined;
  isPassword?: boolean | undefined;
  disabled?: boolean | undefined;
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  error,
  leadingIcon,
  isPassword = false,
  disabled = false,
  ...rest
}) => {
  const [focused, setFocused] = useState(false);
  const [secureVisible, setSecureVisible] = useState(false);

  const borderColorClass = error
    ? "border-chovia-error"
    : focused
      ? "border-chovia-green"
      : "border-[#CBD8D1]";

  return (
    <View className="w-full gap-2">
      <Text className="font-manrope-medium text-[14px] leading-[20px] text-chovia-deep">
        {label}
      </Text>
      <View
        className={`h-[52px] w-full flex-row items-center gap-3 rounded-[16px] border px-4 ${
          disabled ? "bg-slate-100" : "bg-chovia-card"
        } ${borderColorClass}`}
      >
        {leadingIcon && <View className="shrink-0">{leadingIcon}</View>}
        <TextInput
          {...rest}
          editable={!disabled && rest.editable !== false}
          secureTextEntry={isPassword && !secureVisible}
          placeholderTextColor={COLORS.subtle}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          className="flex-1 font-manrope text-[14px] leading-[20px] text-chovia-deep"
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setSecureVisible((v) => !v)}
            hitSlop={8}
            accessibilityLabel={secureVisible ? "Hide password" : "Show password"}
          >
            <EyeIcon size={20} off={secureVisible} />
          </TouchableOpacity>
        )}
      </View>
      {Boolean(error) && (
        <Text className="font-manrope text-[12px] leading-[16px] text-chovia-error">{error}</Text>
      )}
    </View>
  );
};
