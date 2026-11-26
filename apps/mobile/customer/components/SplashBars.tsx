import React from "react";
import { Animated, Dimensions, StyleSheet } from "react-native";
import { COLORS } from "../utils/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const scale = SCREEN_WIDTH / 375;
const yScale = SCREEN_HEIGHT / 812;

// Exact Figma smart animate rectangle parameters (Nodes 1:5856-1:5867 -> 1:5878-1:5889)
export const SPLASH_BARS = [
  { id: 1, s1: { cx: 5.26, cy: 920.02, h: 182.49 }, s2: { cx: -42.32, cy: 844.21, h: 3.72 } },
  { id: 2, s1: { cx: 52.66, cy: 849.33, h: 346.06 }, s2: { cx: 140.95, cy: 1002.25, h: 2.37 } },
  { id: 3, s1: { cx: 75.53, cy: 747.94, h: 596.34 }, s2: { cx: -54.21, cy: 523.22, h: 77.38 } },
  { id: 4, s1: { cx: 147.47, cy: 714.71, h: 772.8 }, s2: { cx: 327.7, cy: 1026.87, h: 51.88 } },
  { id: 5, s1: { cx: 184.08, cy: 620.29, h: 974.49 }, s2: { cx: -50.24, cy: 214.43, h: 37.19 } },
  { id: 6, s1: { cx: 203.54, cy: 496.17, h: 1107.57 }, s2: { cx: 479.35, cy: 973.89, h: 4.33 } },
  { id: 7, s1: { cx: 186.38, cy: 308.61, h: 1166.96 }, s2: { cx: -65.44, cy: -127.56, h: 159.67 } },
  { id: 8, s1: { cx: 268.1, cy: 292.34, h: 904.91 }, s2: { cx: 486.3, cy: 670.27, h: 32.11 } },
  { id: 9, s1: { cx: 367.07, cy: 305.93, h: 962.26 }, s2: { cx: 142.02, cy: -83.87, h: 62.06 } },
  { id: 10, s1: { cx: 372.86, cy: 158.13, h: 460.62 }, s2: { cx: 484.46, cy: 351.43, h: 14.22 } },
  { id: 11, s1: { cx: 420.82, cy: 83.37, h: 287.67 }, s2: { cx: 352.48, cy: -35.01, h: 14.28 } },
  { id: 12, s1: { cx: 464.94, cy: 1.96, h: 121.13 }, s2: { cx: 492.4, cy: 49.52, h: 11.29 } },
] as const;

interface SplashBarsProps {
  anim: Animated.Value;
}

export const SplashBars: React.FC<SplashBarsProps> = ({ anim }) => {
  const barWidth = 80 * scale;

  return (
    <>
      {SPLASH_BARS.map((bar) => {
        const left = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [(bar.s1.cx - 40) * scale, (bar.s2.cx - 40) * scale],
        });

        const height = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [bar.s1.h * yScale, Math.max(2, bar.s2.h * yScale)],
        });

        const top = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [(bar.s1.cy - bar.s1.h / 2) * yScale, (bar.s2.cy - bar.s2.h / 2) * yScale],
        });

        return (
          <Animated.View
            key={bar.id}
            style={[
              styles.bar,
              {
                width: barWidth,
                left,
                top,
                height,
                borderRadius: barWidth / 2,
              },
            ]}
          />
        );
      })}
    </>
  );
};

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    backgroundColor: COLORS.primary,
    transform: [{ rotate: "-30deg" }],
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
});
