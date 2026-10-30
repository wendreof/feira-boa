(() => {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js", {
      scope: "/",
      updateViaCache: "none",
    }).catch((error) => {
      console.warn("Service worker registration failed.", error);
    });

    // OneSignal (push) desativado: os alertas agora usam Telegram (ver alerts-ui/channels.ts).
    // Para reativar, descomente o bloco abaixo e restaure o App ID e os arquivos em /onesignal/.
    // const ONESIGNAL_APP_ID = "510d37b8-17a0-41dd-a0b2-a8d5ca29f2fc";
    // window.OneSignalDeferred = window.OneSignalDeferred || [];
    // let settleReady;
    // const ready = new Promise((resolve) => { settleReady = resolve; });
    // const timeout = setTimeout(() => settleReady(null), 10000);
    // window.OneSignalDeferred.push(async (OneSignal) => {
    //   try {
    //     await OneSignal.init({ appId: ONESIGNAL_APP_ID });
    //     clearTimeout(timeout);
    //     settleReady(OneSignal);
    //   } catch (error) {
    //     console.warn("OneSignal init failed.", error);
    //     clearTimeout(timeout);
    //     settleReady(null);
    //   }
    // });
    // window.__feiraOneSignalReady = ready;
    // if (!document.querySelector('script[src*="OneSignalSDK"]')) {
    //   const script = document.createElement("script");
    //   script.src = "/onesignal/OneSignalSDK.page.es6.js";
    //   script.defer = true;
    //   script.onerror = () => { clearTimeout(timeout); settleReady(null); };
    //   document.head.append(script);
    // }
  });
})();
