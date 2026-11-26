import React from "react";
import { ScrollView, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RiderHeader } from "../../components/RiderHeader";
import { EmptyState, ErrorState, LoadingView } from "../../components/StateViews";
import {
  useMarkAllRiderNotificationsRead,
  useMarkRiderNotificationRead,
  useRiderNotifications,
} from "../../hooks/useRiderQueries";
import { ApiClientError } from "../../services/api";
import { formatShortDate } from "../../utils/formatters";

export default function RiderNotificationsScreen() {
  const { data: notifications, isLoading, isError, error, refetch } = useRiderNotifications();
  const markRead = useMarkRiderNotificationRead();
  const markAllRead = useMarkAllRiderNotificationsRead();

  const hasUnread = (notifications ?? []).some((n) => !n.isRead);

  return (
    <SafeAreaView className="flex-1 bg-chovia-background" edges={["top", "bottom"]}>
      <RiderHeader
        title="Notifications"
        rightSlot={
          hasUnread ? (
            <TouchableOpacity onPress={() => void markAllRead.mutate()}>
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
            title="No notifications yet"
            description="Dispatch alerts and rider updates will appear here."
          />
        ) : (
          notifications.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => {
                if (!item.isRead) void markRead.mutate(item.id);
              }}
              className={`gap-1 rounded-[16px] border p-4 ${
                item.isRead
                  ? "border-transparent bg-chovia-card"
                  : "border-chovia-green/30 bg-emerald-50/50"
              }`}
            >
              <Text className="font-manrope-semibold text-[14px] text-chovia-deep">
                {item.title}
              </Text>
              <Text className="font-manrope text-[13px] text-chovia-muted">{item.body}</Text>
              <Text className="font-manrope text-[11px] text-chovia-subtle">
                {formatShortDate(item.createdAt)}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
