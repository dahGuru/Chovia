import React from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../../components/AccountHeader";
import { Button } from "../../components/Button";

const FAQS = [
  {
    q: "How do I track my active order?",
    a: "Open the Orders tab and tap any active order to view live status updates and assigned rider details.",
  },
  {
    q: "Why can I only order from one restaurant at a time?",
    a: "To keep delivery times fast and fees transparent, each cart holds items from a single kitchen.",
  },
  {
    q: "How are payments verified?",
    a: "All payments are processed by Paystack and verified server-side before your order is confirmed.",
  },
] as const;

export default function CustomerHelpScreen() {
  return (
    <SafeAreaView className="flex-1 bg-chovia-background" edges={["top", "bottom"]}>
      <ScreenHeader title="Help & Support" />

      <ScrollView className="flex-1 px-5" contentContainerClassName="pb-8 pt-3 gap-4">
        <View className="gap-3 rounded-[16px] bg-chovia-card p-4">
          <Text className="font-manrope-bold text-[16px] text-chovia-deep">
            Frequently Asked Questions
          </Text>
          {FAQS.map((faq) => (
            <View key={faq.q} className="border-t border-chovia-border pt-3">
              <Text className="font-manrope-semibold text-[14px] text-chovia-deep">{faq.q}</Text>
              <Text className="mt-1 font-manrope text-[13px] leading-[19px] text-chovia-muted">
                {faq.a}
              </Text>
            </View>
          ))}
        </View>

        <View className="gap-2 rounded-[16px] bg-chovia-card p-4">
          <Text className="font-manrope-semibold text-[15px] text-chovia-deep">
            Need direct assistance?
          </Text>
          <Text className="font-manrope text-[13px] leading-[19px] text-chovia-muted">
            In-app live support chat is awaiting backend WebSocket/messaging persistence. You can
            reach our support desk directly by email.
          </Text>
          <View className="mt-2">
            <Button
              label="Email support@chovia.app"
              variant="secondary"
              onPress={() => void Linking.openURL("mailto:support@chovia.app")}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
