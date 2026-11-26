import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { BackIcon } from "./Icons";

interface RiderHeaderProps {
  title: string;
  onBack?: (() => void) | undefined;
  showBack?: boolean | undefined;
  rightSlot?: React.ReactNode | undefined;
}

export const RiderHeader: React.FC<RiderHeaderProps> = ({
  title,
  onBack,
  showBack = true,
  rightSlot,
}) => (
  <View className="h-[56px] flex-row items-center justify-between px-5">
    <View className="flex-1 flex-row items-center gap-3">
      {showBack && (
        <TouchableOpacity
          onPress={onBack ?? (() => router.back())}
          activeOpacity={0.7}
          className="h-8 w-8 items-center justify-center"
          accessibilityLabel="Go back"
        >
          <BackIcon size={20} />
        </TouchableOpacity>
      )}
      <Text className="flex-1 font-manrope-semibold text-[16px] leading-[23px] text-chovia-deep">
        {title}
      </Text>
    </View>
    {rightSlot}
  </View>
);
