import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Button } from "../../components/Button";
import { ChoviaLogo } from "../../components/ChoviaLogo";
import {
  DiscoverSlideVisual,
  EasyOrderingSlideVisual,
  TrackDeliverySlideVisual,
} from "../../components/OnboardingVisuals";

interface OnboardingSlide {
  title: string;
  description: string;
  buttonLabel: string;
}

const SLIDES: OnboardingSlide[] = [
  {
    title: "Your favourite food.\nMore local choices.",
    description: "Discover restaurants near you and\nget the meals you love, delivered.",
    buttonLabel: "Next",
  },
  {
    title: "Less tapping.\nMore tasting.",
    description: "Pick your favourites, make them yours,\nand check out in just a few taps.",
    buttonLabel: "Next",
  },
  {
    title: "From our kitchen\nto your doorstep",
    description: "Follow your order in real time.\nWe'll keep you in the loop, bite by bite.",
    buttonLabel: "Get started",
  },
];

export default function OnboardingScreen() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide((prev) => prev + 1);
    } else {
      router.replace("/(auth)/login");
    }
  };

  const handleSkip = () => {
    router.replace("/(auth)/login");
  };

  const activeSlide = SLIDES[currentSlide] ?? SLIDES[0]!;

  return (
    <SafeAreaView className="flex-1 bg-chovia-background">
      <View className="flex-1 bg-chovia-background">
        {/* Top Header Bar */}
        <View className="mt-2 h-[54px] flex-row items-center justify-between px-6">
          <ChoviaLogo size={32} withEmblem={false} withTagline={false} mode="dark" />
          <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} className="px-3 py-1.5">
            <Text className="font-manrope-medium text-[14px] text-chovia-subtle">Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Hero Visual Area */}
        <View className="flex-1 items-center justify-center px-6">
          {currentSlide === 0 && <DiscoverSlideVisual />}
          {currentSlide === 1 && <EasyOrderingSlideVisual />}
          {currentSlide === 2 && <TrackDeliverySlideVisual />}
        </View>

        {/* Bottom Content Sheet */}
        <View style={styles.bottomSheet}>
          <View className="mb-6 flex-row items-center justify-center gap-1.5">
            {SLIDES.map((_, index) => {
              const isActive = currentSlide === index;
              return (
                <View
                  key={index}
                  className={`h-1.5 rounded-full ${
                    isActive ? "w-6 bg-chovia-green" : "w-1.5 bg-chovia-dotInactive"
                  }`}
                />
              );
            })}
          </View>

          <View className="mb-6 items-center">
            <Text className="mb-2.5 text-center font-manrope-bold text-[26px] leading-[32px] text-chovia-deep">
              {activeSlide.title}
            </Text>
            <Text className="text-center font-manrope text-[14px] leading-[22px] text-chovia-muted">
              {activeSlide.description}
            </Text>
          </View>

          <Button label={activeSlide.buttonLabel} onPress={handleNext} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bottomSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 36,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 6,
  },
});
