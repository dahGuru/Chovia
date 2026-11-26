import React from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Button } from "../../components/Button";
import { ChevronRightIcon } from "../../components/Icons";
import { EmptyState } from "../../components/StateViews";
import { useAuthStore } from "../../store/useAuthStore";

interface MenuRowProps {
  title: string;
  subtitle?: string;
  onPress: () => void;
}

const ProfileRow: React.FC<MenuRowProps> = ({ title, subtitle, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.75}
    className="flex-row items-center justify-between border-b border-chovia-border py-3.5 last:border-b-0"
  >
    <View className="flex-1 pr-3">
      <Text className="font-manrope-semibold text-[15px] text-chovia-deep">{title}</Text>
      {subtitle && (
        <Text className="mt-0.5 font-manrope text-[12px] text-chovia-muted">{subtitle}</Text>
      )}
    </View>
    <ChevronRightIcon size={18} />
  </TouchableOpacity>
);

export default function CustomerProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);

  if (!isAuthenticated || !user) {
    return (
      <SafeAreaView className="flex-1 bg-chovia-background" edges={["top"]}>
        <View className="flex-1 justify-center px-5">
          <EmptyState
            title="Your CHOVIA Profile"
            description="Sign in to manage your delivery addresses, favourites, and account settings."
            actionLabel="Log in"
            onAction={() => router.push("/(auth)/login")}
          />
        </View>
      </SafeAreaView>
    );
  }

  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || "CHOVIA Customer";

  const handleLogout = () => {
    Alert.alert("Log out?", "You will need to sign in again to place orders.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: () => {
          void logout().then(() => {
            router.replace("/(auth)/login");
          });
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-chovia-background" edges={["top"]}>
      <ScrollView className="flex-1 px-5" contentContainerClassName="pb-8 pt-4 gap-4">
        <Text className="font-manrope-bold text-[24px] text-chovia-deep">Profile</Text>

        {/* User Card */}
        <View className="flex-row items-center gap-4 rounded-[20px] bg-chovia-card p-4">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-chovia-green">
            <Text className="font-manrope-bold text-[20px] text-white">
              {fullName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="font-manrope-bold text-[17px] text-chovia-deep">{fullName}</Text>
            <Text className="font-manrope text-[13px] text-chovia-muted">{user.email}</Text>
            {user.phone && (
              <Text className="font-manrope text-[12px] text-chovia-subtle">{user.phone}</Text>
            )}
          </View>
        </View>

        {/* Account Links */}
        <View className="rounded-[20px] bg-chovia-card px-4 py-1">
          <ProfileRow
            title="Edit Profile"
            subtitle="Update your name and phone number"
            onPress={() => router.push("/profile/edit")}
          />
          <ProfileRow
            title="Delivery Addresses"
            subtitle="Manage saved drop-off locations"
            onPress={() => router.push("/profile/addresses")}
          />
          <ProfileRow
            title="Favourites"
            subtitle="Your saved dishes"
            onPress={() => router.push("/profile/favorites")}
          />
          <ProfileRow
            title="Notifications"
            subtitle="Order updates and alerts"
            onPress={() => router.push("/profile/notifications")}
          />
          <ProfileRow
            title="Payment Methods"
            subtitle="Paystack Checkout (no stored cards on server)"
            onPress={() =>
              Alert.alert(
                "Payment Methods",
                "CHOVIA processes all payments securely per checkout session via Paystack. Saved card tokenization is not yet enabled on the backend."
              )
            }
          />
          <ProfileRow
            title="Help & Support"
            subtitle="FAQs and customer assistance"
            onPress={() => router.push("/profile/help")}
          />
        </View>

        <View className="mt-2">
          <Button label="Log out" variant="secondary" onPress={handleLogout} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
