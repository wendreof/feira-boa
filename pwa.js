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

    // OneSignal v16 SDK is self-hosted (onesignal/) so ad blockers that hide
    // cdn.onesignal.com cannot break push. Official Deferred init pattern.
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

    if (!document.querySelector('script[src*="OneSignalSDK"]')) {
      const script = document.createElement("script");
      script.src = "/onesignal/OneSignalSDK.page.es6.js";
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
