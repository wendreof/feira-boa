(() => {
  // Canonical key: scripts/domain/supabase-auth-storage.mjs (Feira Boa project only).
  const SUPABASE_AUTH_STORAGE_KEY = "sb-muiuvmhzzbqflxznpnez-auth-token";

  function readStoredUserId() {
    try {
      let session = JSON.parse(localStorage.getItem(SUPABASE_AUTH_STORAGE_KEY) || "null");
      if (Array.isArray(session)) session = JSON.parse(session.join(""));
      if (!session?.access_token || !session?.user?.id) return null;
      const expiresAt = session.expires_at;
      if (typeof expiresAt === "number" && expiresAt * 1000 <= Date.now()) return null;
      return String(session.user.id);
    } catch {
      return null;
    }
  }

  const root = document.documentElement;
  root.dataset.authBootstrap = readStoredUserId() ? "signed-in" : "guest";
})();
