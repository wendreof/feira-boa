import type { AlertRule } from "../account";
import type { ProfilePreferences } from "../types";
import type { ThemePreference } from "../theme";

/** Estado compartilhado da página de conta. */
export const accountState: {
  userId: string;
  preferences: ProfilePreferences | null;
  rules: AlertRule[];
  preferencesLoaded: boolean;
  pendingTheme: ThemePreference | null;
  accountPushEnabled: boolean;
  devicePushEnabled: boolean;
  avatarPath: string | null;
} = {
  userId: "",
  preferences: null,
  rules: [],
  preferencesLoaded: false,
  pendingTheme: null,
  accountPushEnabled: false,
  devicePushEnabled: false,
  avatarPath: null,
};
