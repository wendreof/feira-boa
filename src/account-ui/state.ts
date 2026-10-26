import type { ProfilePreferences } from "../types";
import type { ThemePreference } from "../theme";

/** Estado compartilhado das páginas de conta e alertas (conta, dispositivo e avatar). */
export const accountState: {
  userId: string;
  preferences: ProfilePreferences | null;
  preferencesLoaded: boolean;
  pendingTheme: ThemePreference | null;
  accountPushEnabled: boolean;
  devicePushEnabled: boolean;
  avatarPath: string | null;
} = {
  userId: "",
  preferences: null,
  preferencesLoaded: false,
  pendingTheme: null,
  accountPushEnabled: false,
  devicePushEnabled: false,
  avatarPath: null,
};
