import React from "react";
import { Tabs } from "expo-router";
import { RiderBottomBar } from "../../components/RiderBottomBar";

export default function RiderTabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <RiderBottomBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="deliveries" options={{ title: "Deliveries" }} />
      <Tabs.Screen name="earnings" options={{ title: "Earnings" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
