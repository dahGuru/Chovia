import "../global.css";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAppFonts } from "../hooks/useAppFonts";
import { useAuthStore } from "../store/useAuthStore";
import { ENV } from "../utils/env";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useAppFonts();
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  if (ENV.configError) {
    return (
      <SafeAreaProvider>
        <View className="flex-1 justify-center bg-chovia-background px-6">
          <Text className="font-manrope-bold text-[20px] text-chovia-deep">
            Environment Configuration Error
          </Text>
          <Text className="mt-3 font-manrope text-[14px] leading-[22px] text-chovia-error">
            {ENV.configError}
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
