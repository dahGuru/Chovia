import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Tabs } from "expo-router";
import { COLORS } from "../utils/theme";
import { HomeTabIcon, MenuTabIcon, OrdersTabIcon, ProfileTabIcon } from "./Icons";

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>>[0];

const TAB_CONFIG = [
  { name: "index", label: "Home" },
  { name: "menu", label: "Menu" },
  { name: "orders", label: "Orders" },
  { name: "profile", label: "Profile" },
] as const;

export const BottomBar: React.FC<TabBarProps> = ({ state, emitter, navigateToTab }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View className="flex-row items-center justify-between">
        {TAB_CONFIG.map((tab) => {
          const routeIndex = state.routes.findIndex(
            (r: { name: string }) => r.name === tab.name
          );
          if (routeIndex === -1) return null;
          const route = state.routes[routeIndex]!;
          const isFocused = state.index === routeIndex;
          const color = isFocused ? COLORS.primary : COLORS.muted;

          const onPress = () => {
            const event = emitter.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigateToTab(route.key);
            }
          };

          return (
            <TouchableOpacity
              key={tab.name}
              onPress={onPress}
              activeOpacity={0.7}
              className="relative flex-1 items-center gap-0.5 pt-2"
            >
              {isFocused && (
                <View className="absolute top-0 h-[2px] w-12 rounded-b-[4px] bg-chovia-green" />
              )}
              {tab.name === "index" && <HomeTabIcon size={22} color={color} filled={isFocused} />}
              {tab.name === "menu" && <MenuTabIcon size={22} color={color} />}
              {tab.name === "orders" && (
                <OrdersTabIcon size={22} color={color} filled={isFocused} />
              )}
              {tab.name === "profile" && (
                <ProfileTabIcon size={22} color={color} filled={isFocused} />
              )}
              <Text
                className="font-manrope-medium text-[12px] leading-[16px]"
                style={{ color }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
});
