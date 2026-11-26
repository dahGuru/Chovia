import Constants from "expo-constants";
import { Platform } from "react-native";

export interface ResolveApiUrlOptions {
  envUrl?: string | undefined;
  platformOs?: string | undefined;
  isDevice?: boolean | undefined;
}

const DEFAULT_ANDROID_EMULATOR_API_URL = "http://10.0.2.2:4000/api/v1";
const DEFAULT_LOCALHOST_API_URL = "http://localhost:4000/api/v1";

/**
 * Resolves the backend API base URL safely across platforms.
 *
 * - Uses EXPO_PUBLIC_API_URL when configured and valid (http/https).
 * - On Android emulator: falls back to http://10.0.2.2:4000/api/v1.
 * - On iOS simulator & Web: falls back to http://localhost:4000/api/v1.
 * - On physical mobile devices: never falls back to localhost or a hardcoded LAN IP;
 *   throws a clear diagnostic error so misconfiguration fails visibly.
 */
export function resolveApiBaseUrl(options: ResolveApiUrlOptions = {}): string {
  const rawEnvUrl = options.envUrl?.trim();
  if (rawEnvUrl) {
    if (!/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(rawEnvUrl)) {
      throw new Error(
        `Invalid EXPO_PUBLIC_API_URL "${rawEnvUrl}". Expected a valid http:// or https:// URL (e.g. http://<YOUR_LAN_IP>:4000/api/v1).`
      );
    }
    return rawEnvUrl.replace(/\/+$/, "");
  }

  const platformOs = options.platformOs ?? Platform.OS;
  const isDevice = options.isDevice ?? Constants.isDevice;

  if (platformOs === "web") {
    return DEFAULT_LOCALHOST_API_URL;
  }

  if (isDevice) {
    throw new Error(
      "Missing EXPO_PUBLIC_API_URL for physical device. Create apps/mobile/customer/.env from .env.example with EXPO_PUBLIC_API_URL=http://<YOUR_LAN_IP>:4000/api/v1 and restart Expo with cache clear."
    );
  }

  if (platformOs === "android") {
    return DEFAULT_ANDROID_EMULATOR_API_URL;
  }

  return DEFAULT_LOCALHOST_API_URL;
}

function createEnvConfig(): { readonly apiBaseUrl: string; readonly configError: string | null } {
  try {
    return {
      apiBaseUrl: resolveApiBaseUrl({
        envUrl: process.env.EXPO_PUBLIC_API_URL,
      }),
      configError: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid API URL configuration.";
    console.error(`[CHOVIA ENV] ${message}`);
    return {
      apiBaseUrl: "",
      configError: message,
    };
  }
}

export const ENV = createEnvConfig();
