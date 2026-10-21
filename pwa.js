(() => {
  if (!("serviceWorker" in navigator)) return;
  // Em localhost o preview precisa mostrar sempre o build mais recente.
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js", {
      scope: "/",
      updateViaCache: "none",
    }).catch((error) => {
      console.warn("Service worker registration failed.", error);
    });
  });
})();
