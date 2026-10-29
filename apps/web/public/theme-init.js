// Applies the saved theme before first paint so the page doesn't flash.
// A separate file (not inline) because the Content-Security-Policy in
// public/_headers allows no inline scripts. Loaded blocking from <head>.
(function () {
  try {
    var raw = localStorage.getItem("caffeine-tracker:v1");
    var data = raw ? JSON.parse(raw) : null;
    var theme = data && data.settings && data.settings.theme;
    if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  } catch (e) {
    // No storage or corrupt data: fall back to the system theme.
  }
})();
