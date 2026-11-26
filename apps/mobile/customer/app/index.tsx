import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, StatusBar, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { ChoviaLogo } from "../components/ChoviaLogo";
import { SplashBars } from "../components/SplashBars";
import { useAuthStore } from "../store/useAuthStore";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const scale = SCREEN_WIDTH / 375;

export default function SplashScreen() {
  const anim = useRef(new Animated.Value(0)).current;
  const [isSplash2, setIsSplash2] = useState(false);
  const hasNavigatedRef = useRef(false);

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);

  const navigateNext = useCallback(() => {
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    if (isHydrated && isAuthenticated) {
      router.replace("/(tabs)");
    } else {
      router.replace("/(auth)/onboarding");
    }
  }, [isAuthenticated, isHydrated]);

  useEffect(() => {
    let postAnimTimer: ReturnType<typeof setTimeout> | undefined;

    // Stage 1: Hold on Splash 1 (#235347) for 2.0s (matching Figma AFTER_TIMEOUT 2s)
    const holdTimer = setTimeout(() => {
      // Smart Animate transition over 2.555s (Gentle curve)
      Animated.timing(anim, {
        toValue: 1,
        duration: 2555,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (!finished) return;
        setIsSplash2(true);
        // Stage 2: Hold on Splash 2 (#FFFFFF) for 0.8s, then navigate to Onboarding
        postAnimTimer = setTimeout(() => {
          navigateNext();
        }, 800);
      });
    }, 2000);

    return () => {
      clearTimeout(holdTimer);
      if (postAnimTimer) clearTimeout(postAnimTimer);
    };
  }, [anim, navigateNext]);

  const greenUnderlayOpacity = anim.interpolate({
    inputRange: [0, 0.08, 1],
    outputRange: [1, 0, 0],
  });

  return (
    <TouchableOpacity activeOpacity={1} onPress={navigateNext} className="flex-1">
      <StatusBar barStyle={isSplash2 ? "dark-content" : "light-content"} />

      <View className="relative flex-1 overflow-hidden bg-chovia-card">
        <SplashBars anim={anim} />

        <Animated.View
          pointerEvents="none"
          className="absolute inset-0 bg-chovia-green"
          style={{ opacity: greenUnderlayOpacity }}
        />

        <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
          <ChoviaLogo
            size={36 * scale}
            withEmblem={true}
            withTagline={true}
            mode="animated"
            animProgress={anim}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}
