if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((registration) => {
        console.log("Service Worker registriert:", registration);
      })
      .catch((error) => {
        console.error("Service Worker konnte nicht registriert werden:", error);
      });
  });
}
