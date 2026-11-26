import React from "react";
import { Animated, Image, View, type StyleProp, type ViewStyle } from "react-native";
import logoWhite from "../assets/images/chovia_logo_white.png";
import logoDark from "../assets/images/chovia_logo_dark.png";
import wordmark from "../assets/images/chovia_wordmark.png";

export interface ChoviaLogoProps {
  /** Base size multiplier (default 36, scale = size / 36) */
  size?: number;
  /** Whether to show the 3D glossy shopping pin emblem. Default true. */
  withEmblem?: boolean;
  /** Whether to show the tagline ("Food around you. Made easy."). Default true. */
  withTagline?: boolean;
  /** Mode preset: 'light' (white on dark), 'dark' (dark on light), or 'animated' (cross-fade). */
  mode?: "light" | "dark" | "animated";
  /** Required when mode is 'animated': Animated.Value from 0 (light) to 1 (dark). */
  animProgress?: Animated.Value;
  /** Optional container style */
  style?: StyleProp<ViewStyle>;
}

export const ChoviaLogo: React.FC<ChoviaLogoProps> = ({
  size = 36,
  withEmblem = true,
  withTagline = true,
  mode = "dark",
  animProgress,
  style,
}) => {
  const scale = size / 36;

  if (!withEmblem && !withTagline) {
    const width = 85 * scale;
    const height = 31 * scale;
    return (
      <View style={[{ alignItems: "center", justifyContent: "center" }, style]}>
        <Image source={wordmark} style={{ width, height }} resizeMode="contain" />
      </View>
    );
  }

  const width = 158 * scale;
  const height = 53 * scale;

  if (mode === "light") {
    return (
      <View style={[{ alignItems: "center", justifyContent: "center" }, style]}>
        <Image source={logoWhite} style={{ width, height }} resizeMode="contain" />
      </View>
    );
  }

  if (mode === "dark") {
    return (
      <View style={[{ alignItems: "center", justifyContent: "center" }, style]}>
        <Image source={logoDark} style={{ width, height }} resizeMode="contain" />
      </View>
    );
  }

  const whiteOpacity = animProgress
    ? animProgress.interpolate({
        inputRange: [0, 0.7, 1],
        outputRange: [1, 0, 0],
      })
    : 0;

  const darkOpacity = animProgress
    ? animProgress.interpolate({
        inputRange: [0, 0.3, 1],
        outputRange: [0, 1, 1],
      })
    : 1;

  return (
    <View style={[{ width, height, position: "relative" }, style]}>
      <Animated.Image
        source={logoWhite}
        style={{ position: "absolute", inset: 0, width, height, opacity: whiteOpacity }}
        resizeMode="contain"
      />
      <Animated.Image
        source={logoDark}
        style={{ position: "absolute", inset: 0, width, height, opacity: darkOpacity }}
        resizeMode="contain"
      />
    </View>
  );
};
