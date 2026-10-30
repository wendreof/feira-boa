import { refreshNotificationBadge } from "./shared/notification-badge";
import { supabase } from "./supabase-client";

// Entrada do contador de Notificações nas páginas com a barra lateral.
// onAuthStateChange dispara também na carga inicial (INITIAL_SESSION), então não há chamada extra.
supabase.auth.onAuthStateChange(() => void refreshNotificationBadge());
window.addEventListener("focus", () => void refreshNotificationBadge());
