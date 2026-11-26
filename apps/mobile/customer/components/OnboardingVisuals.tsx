import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { COLORS } from "../utils/theme";
import { BikeIcon, CheckIcon, ClockIcon, MinusIcon, SparkleIcon } from "./Icons";

import jollofImage from "../assets/images/jollof_chicken.png";

export const DiscoverSlideVisual: React.FC = () => (
  <View className="w-full items-center justify-center">
    <View style={styles.heroCard}>
      <Image source={jollofImage} className="h-full w-full" resizeMode="cover" />
    </View>
    <View style={styles.floatingPill}>
      <SparkleIcon size={16} color={COLORS.primary} />
      <Text className="font-manrope-medium text-[13px] text-chovia-deep">
        Freshly made. Always delicious.
      </Text>
    </View>
  </View>
);

export const EasyOrderingSlideVisual: React.FC = () => (
  <View className="w-full items-center justify-center">
    <View style={styles.slide2Card}>
      <View className="rounded-[16px] border border-chovia-border bg-chovia-card p-2.5">
        <Image source={jollofImage} className="h-[120px] w-full rounded-[12px]" resizeMode="cover" />
        <Text className="mt-2 font-manrope-bold text-[13px] text-chovia-deep">
          Jollof Rice & Chicken
        </Text>
        <View className="mt-1 flex-row items-center justify-between">
          <Text className="font-manrope-semibold text-[12px] text-chovia-deep">₦7,500.00</Text>
          <View className="h-5 w-5 items-center justify-center rounded-full bg-chovia-green">
            <MinusIcon size={12} color={COLORS.white} />
          </View>
        </View>
      </View>

      <View className="mt-4 flex-row items-center justify-between px-1">
        <Text className="font-manrope-medium text-[13px] leading-[18px] text-chovia-deep">
          {"Your favourite,\nyour way"}
        </Text>
        <View className="flex-row items-center gap-3 rounded-[20px] bg-chovia-background px-3.5 py-1.5">
          <Text className="font-manrope-bold text-[14px] text-chovia-deep">−</Text>
          <Text className="font-manrope-bold text-[13px] text-chovia-deep">1</Text>
          <Text className="font-manrope-bold text-[14px] text-chovia-deep">+</Text>
        </View>
      </View>
    </View>

    <View style={styles.allSetCard}>
      <View className="h-[34px] w-[34px] items-center justify-center rounded-full bg-chovia-background">
        <CheckIcon size={16} color={COLORS.primary} />
      </View>
      <View className="flex-1">
        <Text className="font-manrope-bold text-[13px] text-chovia-deep">You're all set!</Text>
        <Text className="mt-0.5 font-manrope text-[11px] text-chovia-muted">
          Great Meals, just a few taps away.
        </Text>
      </View>
    </View>
  </View>
);

export const TrackDeliverySlideVisual: React.FC = () => (
  <View className="w-full items-center justify-center">
    <View style={styles.mapCard}>
      <View style={[styles.gridH, { top: "22%" }]} />
      <View style={[styles.gridH, { top: "44%" }]} />
      <View style={[styles.gridH, { top: "66%" }]} />
      <View style={[styles.gridH, { top: "88%" }]} />

      <View style={[styles.gridV, { left: "20%" }]} />
      <View style={[styles.gridV, { left: "42%" }]} />
      <View style={[styles.gridV, { left: "64%" }]} />
      <View style={[styles.gridV, { left: "86%" }]} />

      <Text style={styles.mapLabel}>EKPOMA</Text>

      <Svg style={StyleSheet.absoluteFill}>
        <Path
          d="M 230 75 L 230 115 L 135 115 L 135 220 L 75 220"
          stroke={COLORS.primary}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>

      <View style={styles.destPin}>
        <View style={styles.destPinInner} />
      </View>

      <View style={styles.bikeBadge}>
        <BikeIcon size={20} color={COLORS.white} />
      </View>
    </View>

    <View style={styles.etaCard}>
      <View className="h-[34px] w-[34px] items-center justify-center rounded-full bg-chovia-background">
        <ClockIcon size={20} color={COLORS.primary} />
      </View>
      <View className="flex-1">
        <Text className="font-manrope-bold text-[13px] text-chovia-deep">
          Your Meal is on its way
        </Text>
        <Text className="mt-0.5 font-manrope text-[11px] text-chovia-muted">
          Arriving in 12–15 mins
        </Text>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  heroCard: {
    width: 280,
    height: 280,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: COLORS.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  floatingPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 99,
    marginTop: -16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
    gap: 8,
  },
  slide2Card: {
    width: 270,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  allSetCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: 270,
    marginTop: -12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    gap: 12,
  },
  mapCard: {
    width: 290,
    height: 260,
    backgroundColor: COLORS.background,
    borderRadius: 24,
    position: "relative",
    overflow: "hidden",
  },
  gridH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: COLORS.white,
  },
  gridV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 10,
    backgroundColor: COLORS.white,
  },
  mapLabel: {
    position: "absolute",
    top: 60,
    left: 64,
    fontSize: 10,
    fontFamily: "Manrope-Bold",
    color: "#CBD8D1",
    letterSpacing: 0.5,
  },
  destPin: {
    position: "absolute",
    top: 55,
    right: 42,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  destPinInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  bikeBadge: {
    position: "absolute",
    bottom: 25,
    left: 36,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  etaCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: 270,
    marginTop: -20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    gap: 12,
  },
});
