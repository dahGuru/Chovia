import React from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Button } from "../../components/Button";
import { RiderHeader } from "../../components/RiderHeader";
import { useUpdateRiderStatus } from "../../hooks/useRiderQueries";
import { ApiClientError } from "../../services/api";
import { useRiderStore } from "../../store/useRiderStore";

export default function RiderSettingsScreen() {
  const isShiftOnline = useRiderStore((s) => s.isShiftOnline);
  const updateStatus = useUpdateRiderStatus();

  const handleEndShift = async () => {
    try {
      await updateStatus.mutateAsync({ isOnline: false });
      Alert.alert("Shift ended", "Your status is now offline.", [
        { text: "OK", onPress: () => router.replace("/(tabs)") },
      ]);
    } catch (err) {
      Alert.alert(
        "Unable to end shift",
        err instanceof ApiClientError ? err.message : "Could not update status."
      );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-chovia-background" edges={["top", "bottom"]}>
      <RiderHeader title="Settings" />

      <ScrollView className="flex-1 px-5" contentContainerClassName="pt-3 pb-8 gap-4">
        <View className="gap-2 rounded-[16px] bg-chovia-card p-4">
          <Text className="font-manrope-semibold text-[15px] text-chovia-deep">
            Navigation Provider
          </Text>
          <Text className="font-manrope text-[13px] text-chovia-muted">
            Uses your device’s default Google Maps / Apple Maps routing with server-provided
            restaurant and customer coordinates.
          </Text>
        </View>

        <View className="gap-3 rounded-[16px] bg-chovia-card p-4">
          <Text className="font-manrope-semibold text-[15px] text-chovia-deep">Shift Control</Text>
          <Text className="font-manrope text-[13px] text-chovia-muted">
            Current shift status: {isShiftOnline ? "Online (Active)" : "Offline"}
          </Text>
          <Button
            label="End Shift (Go Offline)"
            variant="secondary"
            disabled={!isShiftOnline}
            loading={updateStatus.isPending}
            onPress={() => void handleEndShift()}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
