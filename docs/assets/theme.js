(() => {
  const storageKey = "tim-theme";
  const root = document.documentElement;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  let toggle;
  let theme = "dark";

  try {
    if (window.localStorage.getItem(storageKey) === "light") theme = "light";
  } catch {
    // Storage can be unavailable when opening a local file or blocking site data.
  }

  const applyTheme = () => {
    const light = theme === "light";
    root.dataset.theme = theme;
    themeColor?.setAttribute("content", light ? "#f5f7fb" : "#000000");
    toggle?.setAttribute("aria-checked", String(light));
  };

  // Run in the head, before the stylesheet, to avoid flashing the wrong theme.
  applyTheme();

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
