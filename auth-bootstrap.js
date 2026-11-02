(() => {
  function readStoredUserId() {
    try {
      const storageKey = Object.keys(localStorage).find((key) => /^sb-.*-auth-token$/.test(key));
      if (!storageKey) return null;
      let session = JSON.parse(localStorage.getItem(storageKey) || "null");
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
