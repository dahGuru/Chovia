import React, { useCallback, useEffect, useRef } from "react";
import { Image, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuthStore } from "../store/useAuthStore";

import logoWhite from "../assets/images/chovia_logo_white.png";

export default function RiderSplashScreen() {
  const hasNavigatedRef = useRef(false);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);

  const navigateNext = useCallback(() => {
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    if (isHydrated && isAuthenticated) {
      router.replace("/(tabs)");
    } else {
      router.replace("/(auth)/welcome");
    }
  }, [isAuthenticated, isHydrated]);

  useEffect(() => {
    const timer = setTimeout(() => {
      navigateNext();
    }, 2000);
    return () => clearTimeout(timer);
  }, [navigateNext]);

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={navigateNext}
      className="flex-1 bg-chovia-green"
    >
      <StatusBar barStyle="light-content" />
      <SafeAreaView className="flex-1">
        <View className="flex-1 items-center justify-center px-5">
          <Image
            source={logoWhite}
            style={{ width: 190, height: 64 }}
            resizeMode="contain"
          />
          <Text className="mt-4 font-manrope-bold text-[12px] tracking-[1.5px] text-chovia-card">
            RIDER
          </Text>
          <Text className="mt-3 text-center font-manrope text-[16px] leading-[23px] text-chovia-card">
            Good food. Delivered by you.
          </Text>
        </View>

        <View className="px-5 py-4">
          <Text className="text-center font-manrope text-[12px] leading-[17px] text-chovia-card">
            Your city. Your pace.
          </Text>
        </View>
      </SafeAreaView>
    </TouchableOpacity>
  );
}
