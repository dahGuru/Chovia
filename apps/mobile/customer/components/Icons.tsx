import React from "react";
import Svg, { Circle, Path, Polyline, Rect } from "react-native-svg";
import { COLORS } from "../utils/theme";

interface IconProps {
  size?: number;
  color?: string;
  filled?: boolean;
}

export const SparkleIcon: React.FC<IconProps> = ({ size = 16, color = COLORS.primary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"
      stroke={color}
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
  </Svg>
);

export const CheckIcon: React.FC<IconProps> = ({ size = 16, color = COLORS.primary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Polyline
      points="20 6 9 17 4 12"
      stroke={color}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const ClockIcon: React.FC<IconProps> = ({ size = 20, color = COLORS.primary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={1.8} />
    <Polyline
      points="12 7 12 12 15.5 14"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const BikeIcon: React.FC<IconProps> = ({ size = 20, color = COLORS.white }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="5.5" cy="17.5" r="3" stroke={color} strokeWidth={1.8} />
    <Circle cx="18.5" cy="17.5" r="3" stroke={color} strokeWidth={1.8} />
    <Path
      d="M15 6H17.5L19 11.5M5.5 17.5L9.5 10H15L18.5 17.5M9.5 10L7.5 6H5"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const MinusIcon: React.FC<IconProps> = ({ size = 12, color = COLORS.white }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 12H19" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
  </Svg>
);

export const PlusIcon: React.FC<IconProps> = ({ size = 12, color = COLORS.white }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 5V19M5 12H19" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
  </Svg>
);

export const BackIcon: React.FC<IconProps> = ({ size = 20, color = COLORS.deep }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M19 12H5M11 6L5 12L11 18"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const ChevronRightIcon: React.FC<IconProps> = ({ size = 18, color = COLORS.deep }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M9 18L15 12L9 6"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const MailIcon: React.FC<IconProps> = ({ size = 20, color = COLORS.subtle }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="5" width="18" height="14" rx="2.5" stroke={color} strokeWidth={1.7} />
    <Path d="M4 7L12 13L20 7" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
  </Svg>
);

export const LockIcon: React.FC<IconProps> = ({ size = 20, color = COLORS.subtle }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="4" y="11" width="16" height="10" rx="2.5" stroke={color} strokeWidth={1.7} />
    <Path
      d="M8 11V7C8 4.79 9.79 3 12 3C14.21 3 16 4.79 16 7V11"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
    />
  </Svg>
);

export const UserIcon: React.FC<IconProps> = ({ size = 20, color = COLORS.subtle }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={1.7} />
    <Path
      d="M4.5 20C5.8 16.8 8.6 15 12 15C15.4 15 18.2 16.8 19.5 20"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
    />
  </Svg>
);

export const PhoneIcon: React.FC<IconProps> = ({ size = 20, color = COLORS.subtle }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M22 16.92V19.92C22 20.99 21.1 21.86 20.03 21.82C10.5 21.24 2.76 13.5 2.18 3.97C2.14 2.9 3.01 2 4.08 2H7.08C7.98 2 8.75 2.62 8.95 3.5L9.71 6.95C9.88 7.72 9.57 8.51 8.94 8.98L7.29 10.22C8.72 13.03 10.97 15.28 13.78 16.71L15.02 15.06C15.49 14.43 16.28 14.12 17.05 14.29L20.5 15.05C21.38 15.25 22 16.02 22 16.92Z"
      stroke={color}
      strokeWidth={1.7}
      strokeLinejoin="round"
    />
  </Svg>
);

export const EyeIcon: React.FC<IconProps & { off?: boolean }> = ({
  size = 20,
  color = COLORS.subtle,
  off = false,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M2 12C3.8 7.9 7.6 5.5 12 5.5C16.4 5.5 20.2 7.9 22 12C20.2 16.1 16.4 18.5 12 18.5C7.6 18.5 3.8 16.1 2 12Z"
      stroke={color}
      strokeWidth={1.7}
    />
    <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={1.7} />
    {off && <Path d="M3 21L21 3" stroke={color} strokeWidth={1.7} strokeLinecap="round" />}
  </Svg>
);

export const PinIcon: React.FC<IconProps> = ({ size = 20, color = COLORS.primary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 21C16 17.2 19 13.8 19 10C19 6.13 15.87 3 12 3C8.13 3 5 6.13 5 10C5 13.8 8 17.2 12 21Z"
      stroke={color}
      strokeWidth={1.8}
    />
    <Circle cx="12" cy="10" r="2.5" stroke={color} strokeWidth={1.8} />
  </Svg>
);

export const BellIcon: React.FC<IconProps> = ({ size = 20, color = COLORS.deep }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M18 8A6 6 0 0 0 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8ZM13.73 21A2 2 0 0 1 10.27 21"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const SearchIcon: React.FC<IconProps> = ({ size = 20, color = COLORS.subtle }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth={1.8} />
    <Path d="M20 20L16.2 16.2" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);

export const HeartIcon: React.FC<IconProps> = ({
  size = 20,
  color = COLORS.deep,
  filled = false,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "#EF4444" : "none"}>
    <Path
      d="M12 20.5C12 20.5 4 15.3 4 9.6C4 6.9 6.1 4.8 8.7 4.8C10.2 4.8 11.5 5.6 12 6.7C12.5 5.6 13.8 4.8 15.3 4.8C17.9 4.8 20 6.9 20 9.6C20 15.3 12 20.5 12 20.5Z"
      stroke={filled ? "#EF4444" : color}
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
  </Svg>
);

export const StarIcon: React.FC<IconProps> = ({ size = 14, color = COLORS.gold }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12 2L14.9 8.6L22 9.3L16.6 14L18.2 21L12 17.3L5.8 21L7.4 14L2 9.3L9.1 8.6L12 2Z" />
  </Svg>
);

export const HomeTabIcon: React.FC<IconProps> = ({
  size = 24,
  color = COLORS.muted,
  filled = false,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : "none"}>
    <Path
      d="M3 10.5L12 3L21 10.5V20C21 20.55 20.55 21 20 21H15V14.5H9V21H4C3.45 21 3 20.55 3 20V10.5Z"
      stroke={color}
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
  </Svg>
);

export const MenuTabIcon: React.FC<IconProps> = ({ size = 24, color = COLORS.muted }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M4 6H20M4 12H20M4 18H14"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </Svg>
);

export const OrdersTabIcon: React.FC<IconProps> = ({
  size = 24,
  color = COLORS.muted,
  filled = false,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : "none"}>
    <Rect
      x="5"
      y="3.5"
      width="14"
      height="17"
      rx="2.5"
      stroke={color}
      strokeWidth={1.8}
    />
    <Path
      d="M8.5 8.5H15.5M8.5 12.5H15.5M8.5 16.5H12.5"
      stroke={filled ? COLORS.white : color}
      strokeWidth={1.8}
      strokeLinecap="round"
    />
  </Svg>
);

export const ProfileTabIcon: React.FC<IconProps> = ({
  size = 24,
  color = COLORS.muted,
  filled = false,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : "none"}>
    <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={1.8} />
    <Path
      d="M4.5 20C5.8 16.8 8.6 15 12 15C15.4 15 18.2 16.8 19.5 20"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
    />
  </Svg>
);

export const CartBagIcon: React.FC<IconProps> = ({ size = 20, color = COLORS.white }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M6 8H18L19 20H5L6 8Z"
      stroke={color}
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
    <Path
      d="M9 8V6C9 4.34 10.34 3 12 3C13.66 3 15 4.34 15 6V8"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
    />
  </Svg>
);
