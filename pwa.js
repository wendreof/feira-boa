(() => {
  if (!("serviceWorker" in navigator)) return;

  // Keep in sync with the ONESIGNAL_APP_ID extracted by send-price-alerts.yml.
  const ONESIGNAL_APP_ID = "510d37b8-17a0-41dd-a0b2-a8d5ca29f2fc";

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js", {
      scope: "/",
      updateViaCache: "none",
    }).catch((error) => {
      console.warn("Service worker registration failed.", error);
    });

    // Official OneSignal v16 init via the Deferred queue. Pages await
    // window.__feiraOneSignalReady (resolves to OneSignal or null).
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    let settleReady;
    const ready = new Promise((resolve) => { settleReady = resolve; });
    const timeout = setTimeout(() => settleReady(null), 10000);
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.init({ appId: ONESIGNAL_APP_ID });
        clearTimeout(timeout);
        settleReady(OneSignal);
      } catch (error) {
        console.warn("OneSignal init failed.", error);
        clearTimeout(timeout);
        settleReady(null);
      }
    });
    window.__feiraOneSignalReady = ready;

    if (!document.querySelector('script[src*="OneSignalSDK.page.js"]')) {
      const script = document.createElement("script");
      script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
      script.defer = true;
      script.onerror = () => {
        clearTimeout(timeout);
        settleReady(null);
        console.warn("OneSignal SDK failed to load.");
      };
      document.head.append(script);
    }
  });
})();
