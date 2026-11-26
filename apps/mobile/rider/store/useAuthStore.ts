import { create } from "zustand";
import { ApiClientError, registerUnauthorizedHandler } from "../services/api";
import { authService, type LoginRequestDto, type UserResponseDto } from "../services/authService";
import { tokenStorage } from "../services/tokenStorage";
import { useRiderStore } from "./useRiderStore";

interface AuthState {
  user: UserResponseDto | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  login: (payload: LoginRequestDto) => Promise<UserResponseDto>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  registerUnauthorizedHandler(() => {
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  return {
    user: null,
    isAuthenticated: false,
    isHydrated: false,
    isLoading: false,
    error: null,

    hydrate: async () => {
      set({ isLoading: true, error: null });
      try {
        const accessToken = await tokenStorage.getAccessToken();
        if (!accessToken) {
          set({ user: null, isAuthenticated: false, isHydrated: true, isLoading: false });
          return;
        }
        const user = await authService.getMe();
        if (user.role !== "RIDER" && user.role !== "ADMIN") {
          await tokenStorage.clearTokens();
          set({
            user: null,
            isAuthenticated: false,
            isHydrated: true,
            isLoading: false,
            error: "This application is restricted to CHOVIA Rider accounts.",
          });
          return;
        }
        set({ user, isAuthenticated: true, isHydrated: true, isLoading: false });
      } catch {
        await tokenStorage.clearTokens();
        set({ user: null, isAuthenticated: false, isHydrated: true, isLoading: false });
      }
    },

    login: async (payload: LoginRequestDto) => {
      set({ isLoading: true, error: null });
      try {
        const result = await authService.login(payload);
        if (result.user.role !== "RIDER" && result.user.role !== "ADMIN") {
          const roleError = new ApiClientError(
            403,
            "INVALID_ROLE",
            "Please sign in with a valid CHOVIA Rider account."
          );
          set({ isLoading: false, error: roleError.message });
          throw roleError;
        }
        await tokenStorage.setTokens(result.accessToken, result.refreshToken);
        set({
          user: result.user,
          isAuthenticated: true,
          isHydrated: true,
          isLoading: false,
        });
        return result.user;
      } catch (err) {
        const message =
          err instanceof ApiClientError ? err.message : "Failed to sign in. Please try again.";
        set({ isLoading: false, error: message });
        throw err;
      }
    },

    logout: async () => {
      set({ isLoading: true });
      try {
        const refreshToken = await tokenStorage.getRefreshToken();
        if (refreshToken) {
          await authService.logout(refreshToken).catch(() => undefined);
        }
      } finally {
        await tokenStorage.clearTokens();
        useRiderStore.getState().resetSessionState();
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      }
    },

    clearError: () => set({ error: null }),
  };
});
