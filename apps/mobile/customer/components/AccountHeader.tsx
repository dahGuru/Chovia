import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { ChoviaLogo } from "./ChoviaLogo";
import { BackIcon } from "./Icons";

interface AccountHeaderProps {
  onBack?: (() => void) | undefined;
  showBack?: boolean | undefined;
}

export const AccountHeader: React.FC<AccountHeaderProps> = ({ onBack, showBack = true }) => (
  <View className="w-full px-5 pb-8 pt-2">
    <View className="h-[40px] flex-row items-center justify-between">
      {showBack ? (
        <TouchableOpacity
          onPress={onBack ?? (() => router.back())}
          activeOpacity={0.7}
          style={styles.backBtn}
          accessibilityLabel="Go back"
        >
          <BackIcon size={20} />
        </TouchableOpacity>
      ) : (
        <View className="h-[40px] w-[40px]" />
      )}
      <ChoviaLogo size={30} withEmblem={false} withTagline={false} mode="dark" />
    </View>
  </View>
);

interface ScreenHeaderProps {
  title: string;
  onBack?: (() => void) | undefined;
  rightSlot?: React.ReactNode | undefined;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, onBack, rightSlot }) => (
  <View className="h-[56px] flex-row items-center justify-between px-5">
    <View className="flex-row items-center gap-3">
      <TouchableOpacity
        onPress={onBack ?? (() => router.back())}
        activeOpacity={0.7}
        style={styles.backBtn}
        accessibilityLabel="Go back"
      >
        <BackIcon size={20} />
      </TouchableOpacity>
      <Text className="font-manrope-semibold text-[18px] leading-[24px] text-chovia-deep">
        {title}
      </Text>
    </View>
    {rightSlot}
  </View>
);

const styles = StyleSheet.create({
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 99,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
});
