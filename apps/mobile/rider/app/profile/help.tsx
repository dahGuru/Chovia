import React from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../components/Button";
import { RiderHeader } from "../../components/RiderHeader";

export default function RiderHelpScreen() {
  return (
    <SafeAreaView className="flex-1 bg-chovia-background" edges={["top", "bottom"]}>
      <RiderHeader title="Help & Support" />

      <ScrollView className="flex-1 px-5" contentContainerClassName="pt-3 pb-8 gap-4">
        <View className="gap-2 rounded-[16px] bg-chovia-card p-4">
          <Text className="font-manrope-bold text-[16px] text-chovia-deep">
            Delivery Guidelines
          </Text>
          <Text className="font-manrope text-[13px] leading-[19px] text-chovia-muted">
            1. Confirm order items with restaurant staff before marking an order collected.
          </Text>
          <Text className="font-manrope text-[13px] leading-[19px] text-chovia-muted">
            2. Keep meals upright and sealed in your insulated delivery bag.
          </Text>
          <Text className="font-manrope text-[13px] leading-[19px] text-chovia-muted">
            3. Only confirm delivery completion after handing the order to the customer.
          </Text>
        </View>

        <View className="gap-2 rounded-[16px] bg-chovia-card p-4">
          <Text className="font-manrope-semibold text-[15px] text-chovia-deep">
            Dispatch Support
          </Text>
          <Text className="font-manrope text-[13px] leading-[19px] text-chovia-muted">
            Live in-app support chat is awaiting backend messaging APIs. Contact dispatch directly
            by email for urgent assistance.
          </Text>
          <View className="mt-2">
            <Button
              label="Email riders@chovia.app"
              variant="secondary"
              onPress={() => void Linking.openURL("mailto:riders@chovia.app")}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
