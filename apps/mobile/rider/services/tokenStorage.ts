import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const ACCESS_TOKEN_KEY = "chovia_rider_access_token";
const REFRESH_TOKEN_KEY = "chovia_rider_refresh_token";

// In-memory fallback for web/SSR where SecureStore is unavailable.
// Avoids storing sensitive tokens in unencrypted localStorage.
const memoryStorage = new Map<string, string>();

const isNativeSecureStoreAvailable = (): boolean => Platform.OS !== "web";

async function setItem(key: string, value: string): Promise<void> {
  memoryStorage.set(key, value);
  if (isNativeSecureStoreAvailable()) {
    await SecureStore.setItemAsync(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  const memValue = memoryStorage.get(key);
  if (memValue !== undefined) {
    return memValue;
  }
  if (isNativeSecureStoreAvailable()) {
    const stored = await SecureStore.getItemAsync(key);
    if (stored !== null) {
      memoryStorage.set(key, stored);
    }
    return stored;
  }
  return null;
}

async function deleteItem(key: string): Promise<void> {
  memoryStorage.delete(key);
  if (isNativeSecureStoreAvailable()) {
    await SecureStore.deleteItemAsync(key);
  }
}

export const tokenStorage = {
  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await Promise.all([
      setItem(ACCESS_TOKEN_KEY, accessToken),
      setItem(REFRESH_TOKEN_KEY, refreshToken),
    ]);
  },

  async getAccessToken(): Promise<string | null> {
    return getItem(ACCESS_TOKEN_KEY);
  },

  async getRefreshToken(): Promise<string | null> {
    return getItem(REFRESH_TOKEN_KEY);
  },

  async clearTokens(): Promise<void> {
    await Promise.all([deleteItem(ACCESS_TOKEN_KEY), deleteItem(REFRESH_TOKEN_KEY)]);
  },
};
