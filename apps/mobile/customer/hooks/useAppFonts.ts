import { useFonts } from "expo-font";
import ManropeRegular from "../assets/fonts/Manrope-Regular.ttf";
import ManropeMedium from "../assets/fonts/Manrope-Medium.ttf";
import ManropeSemiBold from "../assets/fonts/Manrope-SemiBold.ttf";
import ManropeBold from "../assets/fonts/Manrope-Bold.ttf";

export function useAppFonts() {
  return useFonts({
    "Manrope-Regular": ManropeRegular,
    "Manrope-Medium": ManropeMedium,
    "Manrope-SemiBold": ManropeSemiBold,
    "Manrope-Bold": ManropeBold,
  });
}
