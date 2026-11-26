import React from "react";
import { ScrollView, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Button } from "../../components/Button";
import { BackIcon } from "../../components/Icons";
import { RiderArtwork } from "../../components/RiderArtwork";

export default function RiderWelcomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-chovia-background">
      <StatusBar barStyle="dark-content" />
      <View className="flex-1 bg-chovia-background">
        {/* App Header */}
        <View className="h-[56px] flex-row items-center gap-3 px-5">
          <TouchableOpacity
            onPress={() => router.replace("/")}
            activeOpacity={0.7}
            className="h-8 w-8 items-center justify-center"
          >
            <BackIcon size={20} />
          </TouchableOpacity>
          <Text className="flex-1 font-manrope-semibold text-[16px] leading-[23px] text-chovia-deep">
            Chovia Rider
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

          <View className="rounded-[16px] bg-chovia-card p-3">
            <Text className="font-manrope-semibold text-[12px] leading-[17px] text-chovia-green">
              DELIVER WITH CHOVIA
            </Text>
          </View>

          <Text className="font-manrope-semibold text-[28px] leading-[41px] text-chovia-deep">
            {"Your next move\nstarts here."}
          </Text>

          <Text className="font-manrope text-[14px] leading-[20px] text-chovia-muted">
            Bring great meals to your neighbourhood. Ride with Chovia and earn on your terms.
          </Text>
        </ScrollView>

        {/* Screen Actions */}
        <View className="gap-3 px-5 py-3">
          <Button
            label="Get started"
            variant="primary"
            onPress={() => router.push("/(auth)/onboarding")}
          />
          <Button
            label="I already have an account"
            variant="secondary"
            onPress={() => router.push("/(auth)/login")}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
