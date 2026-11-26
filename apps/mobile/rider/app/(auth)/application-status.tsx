import React from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Button } from "../../components/Button";
import { RiderHeader } from "../../components/RiderHeader";
import { EmptyState, ErrorState, LoadingView } from "../../components/StateViews";
import { useRiderKycApplication, useRiderSessionProfile } from "../../hooks/useRiderQueries";
import { ApiClientError } from "../../services/api";
import { useAuthStore } from "../../store/useAuthStore";
import { formatShortDate } from "../../utils/formatters";
import { COLORS } from "../../utils/theme";

export default function RiderApplicationStatusScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);

  const {
    data: profile,
    isLoading: profileLoading,
    refetch: refetchProfile,
    isRefetching: refetchingProfile,
  } = useRiderSessionProfile();

  const {
    data: application,
    isLoading: appLoading,
    isError,
    error,
    refetch: refetchApp,
    isRefetching: refetchingApp,
  } = useRiderKycApplication();

  if (!isAuthenticated) {
    return (
      <SafeAreaView className="flex-1 bg-chovia-background" edges={["top", "bottom"]}>
        <RiderHeader title="Application Status" />
        <View className="flex-1 justify-center px-5">
          <EmptyState
            title="Sign in required"
            description="Sign in with your CHOVIA Rider account to check your verification status."
            actionLabel="Log in"
            onAction={() => router.replace("/(auth)/login")}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (profileLoading || appLoading) {
    return (
      <SafeAreaView className="flex-1 bg-chovia-background" edges={["top", "bottom"]}>
        <RiderHeader title="Application Status" />
        <LoadingView label="Checking application status..." />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-chovia-background" edges={["top", "bottom"]}>
        <RiderHeader title="Application Status" />
        <ErrorState
          message={error instanceof ApiClientError ? error.message : "Could not load KYC status."}
          onRetry={() => void refetchApp()}
        />
      </SafeAreaView>
    );
  }

  if (!application) {
    return (
      <SafeAreaView className="flex-1 bg-chovia-background" edges={["top", "bottom"]}>
        <RiderHeader title="Application Status" />
        <View className="flex-1 justify-center px-5">
          <EmptyState
            title="KYC application not submitted"
            description="Complete your personal, vehicle, bank payout, and document verification details to start riding."
            actionLabel="Start KYC Application"
            onAction={() => router.replace("/(auth)/kyc")}
          />
        </View>
      </SafeAreaView>
    );
  }

  const isApproved = application.status === "APPROVED" && profile?.status === "ACTIVE";
  const isRejected = application.status === "REJECTED";
  const isSuspended = profile?.status === "SUSPENDED" || profile?.status === "DEACTIVATED";

  const statusConfig = isSuspended
    ? {
        badge: `PROFILE ${profile?.status}`,
        title: "Account restricted",
        description:
          "Your rider profile is currently restricted by operations. Contact CHOVIA support for assistance.",
        boxClass: "border-red-300 bg-red-50",
        textClass: "text-red-900",
      }
    : isApproved
      ? {
          badge: "APPROVED",
          title: "You’re approved to ride!",
          description:
            "Your documents and profile have been verified. Proceed to the Rider Dashboard to go online and accept deliveries.",
          boxClass: "border-emerald-300 bg-emerald-50",
          textClass: "text-emerald-900",
        }
      : isRejected
        ? {
            badge: "ACTION REQUIRED",
            title: "Application requires updates",
            description:
              application.rejectionReason ||
              "Your application was not approved. Review your submitted details and resubmit.",
            boxClass: "border-red-300 bg-red-50",
            textClass: "text-red-900",
          }
        : {
            badge: application.status.replace("_", " "),
            title: "Application under review",
            description:
              "CHOVIA Operations is reviewing your identity, vehicle, and bank payout details. Pull down or tap Refresh to check for updates.",
            boxClass: "border-amber-300 bg-amber-50",
            textClass: "text-amber-900",
          };

  return (
    <SafeAreaView className="flex-1 bg-chovia-background" edges={["top", "bottom"]}>
      <RiderHeader title="Application Status" onBack={() => router.replace("/(tabs)")} />
      <ScrollView
        className="flex-1 px-5"
        contentContainerClassName="pt-3 pb-10 gap-4"
        refreshControl={
          <RefreshControl
            refreshing={refetchingProfile || refetchingApp}
            onRefresh={() => {
              void refetchProfile();
              void refetchApp();
            }}
            tintColor={COLORS.primary}
          />
        }
      >
        <View className={`gap-2 rounded-[16px] border p-4 ${statusConfig.boxClass}`}>
          <Text className={`font-manrope-bold text-[11px] tracking-[1px] ${statusConfig.textClass}`}>
            {statusConfig.badge}
          </Text>
          <Text className={`font-manrope-bold text-[20px] ${statusConfig.textClass}`}>
            {statusConfig.title}
          </Text>
          <Text className={`font-manrope text-[13px] leading-[19px] ${statusConfig.textClass}`}>
            {statusConfig.description}
          </Text>
        </View>

        <View className="gap-2 rounded-[16px] bg-chovia-card p-4">
          <Text className="font-manrope-semibold text-[16px] text-chovia-deep">
            Submitted Summary
          </Text>
          <Text className="font-manrope text-[13px] text-chovia-muted">
            Applicant: {application.firstName} {application.lastName}
          </Text>
          <Text className="font-manrope text-[13px] text-chovia-muted">
            Operating City: {application.operatingCity}
          </Text>
          <Text className="font-manrope text-[13px] text-chovia-muted">
            Vehicle: {application.vehicleType}
            {application.vehiclePlateNumber ? ` (${application.vehiclePlateNumber})` : ""}
          </Text>
          <Text className="font-manrope text-[13px] text-chovia-muted">
            ID ({application.governmentIdType}): {application.governmentIdMasked}
          </Text>
          <Text className="font-manrope text-[13px] text-chovia-muted">
            Bank: {application.bankName} ({application.bankAccountMasked})
          </Text>
          <Text className="font-manrope text-[13px] text-chovia-muted">
            Verified Documents: {application.documents.length} uploaded privately
          </Text>
          <Text className="font-manrope text-[12px] text-chovia-subtle">
            Submitted {formatShortDate(application.submittedAt)}
          </Text>
        </View>

        <View className="gap-2.5 pt-2">
          {isApproved && (
            <Button
              label="Go to Rider Dashboard"
              onPress={() => router.replace("/(tabs)")}
            />
          )}
          {isRejected && (
            <Button
              label="Update & Resubmit Application"
              onPress={() => router.push("/(auth)/kyc")}
            />
          )}
          {!isApproved && (
            <Button
              label="Refresh Status"
              variant="secondary"
              onPress={() => {
                void refetchProfile();
                void refetchApp();
              }}
            />
          )}
          <Button
            label="Log out"
            variant="secondary"
            onPress={() => void logout().then(() => router.replace("/(auth)/login"))}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
