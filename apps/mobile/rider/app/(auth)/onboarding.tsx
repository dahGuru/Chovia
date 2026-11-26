import React from "react";
import { ScrollView, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Button } from "../../components/Button";
import { BackIcon } from "../../components/Icons";
import { RiderArtwork } from "../../components/RiderArtwork";

const RIDER_BENEFITS = [
  { num: "01", text: "Flexible hours, no fixed shifts" },
  { num: "02", text: "Clear earnings on every trip" },
  { num: "03", text: "Rider support when you need it" },
] as const;

export default function RiderOnboardingScreen() {
  return (
    <SafeAreaView className="flex-1 bg-chovia-background">
      <StatusBar barStyle="dark-content" />
      <View className="flex-1 bg-chovia-background">
        {/* App Header */}
        <View className="h-[56px] flex-row items-center gap-3 px-5">
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            className="h-8 w-8 items-center justify-center"
          >
            <BackIcon size={20} />
          </TouchableOpacity>
          <Text className="flex-1 font-manrope-semibold text-[16px] leading-[23px] text-chovia-deep">
            Why ride with us?
          </Text>
        </View>

        {/* Screen Body */}
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 py-4 gap-4"
          showsVerticalScrollIndicator={false}
        >
          <View className="items-center rounded-[16px] p-6">
            <RiderArtwork width={237} height={208} />
          </View>

          <Text className="font-manrope-semibold text-[28px] leading-[41px] text-chovia-deep">
            {"More freedom.\nMore possibilities."}
          </Text>

          <Text className="font-manrope text-[14px] leading-[20px] text-chovia-muted">
            Choose when you ride and see what you’ll earn before every delivery.
          </Text>

          <View className="gap-3 rounded-[16px] bg-chovia-card p-4">
            {RIDER_BENEFITS.map((item) => (
              <View key={item.num} className="flex-row items-center gap-3">
                <Text className="font-manrope-semibold text-[14px] leading-[20px] text-chovia-green">
                  {item.num}
                </Text>
                <Text className="flex-1 font-manrope-semibold text-[14px] leading-[20px] text-chovia-deep">
                  {item.text}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Screen Actions */}
        <View className="px-5 py-3">
          <Button
            label="Become a rider"
            variant="primary"
            onPress={() => router.push("/(auth)/register")}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
