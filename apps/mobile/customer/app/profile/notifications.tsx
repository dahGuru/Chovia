import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../../components/AccountHeader";
import { EmptyState, ErrorState, LoadingView } from "../../components/StateViews";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "../../hooks/useCustomerQueries";
import { ApiClientError } from "../../services/api";
import { formatShortDate } from "../../utils/formatters";

export default function CustomerNotificationsScreen() {
  const { data: notifications, isLoading, isError, error, refetch } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const hasUnread = (notifications ?? []).some((n) => !n.isRead);

  return (
    <SafeAreaView className="flex-1 bg-chovia-background" edges={["top", "bottom"]}>
      <ScreenHeader
        title="Notifications"
        rightSlot={
          hasUnread ? (
            <TouchableOpacity
              onPress={() => void markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <Text className="font-manrope-semibold text-[13px] text-chovia-green">
                Mark all read
              </Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      <ScrollView className="flex-1 px-5" contentContainerClassName="pb-8 pt-3 gap-3">
        {isLoading ? (
          <LoadingView label="Loading notifications..." />
        ) : isError ? (
          <ErrorState
            message={
              error instanceof ApiClientError ? error.message : "Could not load notifications."
            }
            onRetry={() => void refetch()}
          />
        ) : !notifications || notifications.length === 0 ? (
          <EmptyState
            title="You’re all caught up"
            description="Order status updates and important alerts will appear here."
          />
        ) : (
          notifications.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => {
                if (!item.isRead) {
                  void markRead.mutate(item.id);
                }
              }}
              activeOpacity={0.85}
              className={`gap-1 rounded-[16px] border p-4 ${
                item.isRead
                  ? "border-transparent bg-chovia-card"
                  : "border-chovia-green/30 bg-emerald-50/50"
              }`}
            >
              <View className="flex-row items-center justify-between">
                <Text className="flex-1 font-manrope-semibold text-[14px] text-chovia-deep">
                  {item.title}
                </Text>
                {!item.isRead && <View className="h-2 w-2 rounded-full bg-chovia-green" />}
              </View>
              <Text className="font-manrope text-[13px] leading-[19px] text-chovia-muted">
                {item.body}
              </Text>
              <Text className="mt-1 font-manrope text-[11px] text-chovia-subtle">
                {formatShortDate(item.createdAt)}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
