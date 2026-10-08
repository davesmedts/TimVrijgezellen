(() => {
  const storageKey = "tim-theme";
  const root = document.documentElement;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  let toggle;
  let theme = "dark";

  const readCookie = () => {
    try {
      return document.cookie.match(/(?:^|;\s*)tim-theme=(light|dark)(?:;|$)/)?.[1] ?? null;
    } catch {
      return null;
    }
  };

  const writeCookie = (value) => {
    try {
      document.cookie = `tim-theme=${value}; max-age=31536000; path=/; SameSite=Lax`;
    } catch {
      // Cookies can be blocked as well; the in-memory theme keeps working.
    }
  };

  const readStore = (store) => {
    try {
      const value = store.getItem(storageKey);
      return value === "light" || value === "dark" ? value : null;
    } catch {
      return null;
    }
  };

  const writeStore = (store, value) => {
    try {
      store.setItem(storageKey, value);
    } catch {
      // This store can be unavailable or full; the other stores still get the value.
    }
  };

  // Local storage is the source of truth. Session storage and a cookie carry the
  // choice when the browser blocks, clears or partitions local storage.
  const readStoredTheme = () => {
    for (const store of availableStores()) {
      const value = readStore(store);
      if (value) return value;
    }
    return readCookie() ?? theme;
  };

  const writeStoredTheme = (value) => {
    for (const store of availableStores()) writeStore(store, value);
    writeCookie(value);
  };

  function availableStores() {
    const stores = [];
    try { stores.push(window.localStorage); } catch { /* storage blocked */ }
    try { stores.push(window.sessionStorage); } catch { /* storage blocked */ }
    return stores;
  }

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
      writeStoredTheme(theme);
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeToggle, { once: true });
  } else {
    initializeToggle();
  }
})();