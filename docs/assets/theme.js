(() => {
  const storageKey = "tim-theme";
  const root = document.documentElement;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  let toggle;
  let theme = "dark";

  const readStoredTheme = () => {
    try {
      return window.localStorage.getItem(storageKey) === "light" ? "light" : "dark";
    } catch {
      // Storage can be unavailable when opening a local file or blocking site data.
      // Keep the theme this page is already showing.
      return theme;
    }
  };

  theme = readStoredTheme();

  const applyTheme = () => {
    const light = theme === "light";
    root.dataset.theme = theme;
    themeColor?.setAttribute("content", light ? "#f5f7fb" : "#000000");
    toggle?.setAttribute("aria-checked", String(light));
  };

  // Run in the head, before the stylesheet, to avoid flashing the wrong theme.
  applyTheme();

  // Another browser tab can flip the preference after this document was parsed,
  // and a page restored from the back/forward cache is not re-parsed at all.
  // Re-read the stored choice so every open page shows the same theme.
  const syncTheme = () => {
    theme = readStoredTheme();
    applyTheme();
  };

  window.addEventListener("storage", (event) => {
    if (event.key !== null && event.key !== storageKey) return;
    syncTheme();
  });
  window.addEventListener("pageshow", syncTheme);

  const initializeToggle = () => {
    toggle = document.querySelector("[data-theme-toggle]");
    if (!toggle) return;

    applyTheme();
    toggle.hidden = false;
    toggle.addEventListener("click", () => {
      theme = theme === "light" ? "dark" : "light";
      applyTheme();
      try {
        window.localStorage.setItem(storageKey, theme);
      } catch {
        // Switching still works for this page when the preference cannot be saved.
      }
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeToggle, { once: true });
  } else {
    initializeToggle();
  }
})();
