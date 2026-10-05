import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const source = await readFile(new URL("../docs/assets/theme.js", import.meta.url), "utf8");

function render(options = {}) {
  const root = { dataset: {} };
  const attributes = { "aria-checked": "false" };
  const meta = {};
  const events = {};
  const windowEvents = {};
  const saved = new Map(options.saved === undefined ? [] : [["tim-theme", options.saved]]);
  let ready;
  const toggle = {
    hidden: true,
    setAttribute: (name, value) => { attributes[name] = value; },
    addEventListener: (name, callback) => { events[name] = callback; },
  };
  runInNewContext(source, {
    document: {
      documentElement: root,
      readyState: options.ready ? "complete" : "loading",
      querySelector: (selector) => selector === "[data-theme-toggle]"
        ? options.noToggle ? null : toggle
        : options.noMeta ? null : { setAttribute: (name, value) => { meta[name] = value; } },
      addEventListener: (name, callback) => { if (name === "DOMContentLoaded") ready = callback; },
    },
    window: {
      addEventListener: (name, callback) => { windowEvents[name] = callback; },
      get localStorage() {
        if (options.blocked) throw new Error("Storage blocked");
        return {
          getItem: (key) => saved.get(key) ?? null,
          setItem: (key, value) => {
            if (options.readOnly) throw new Error("Storage quota exceeded");
            saved.set(key, value);
          },
        };
      },
    },
  });
  return {
    root,
    toggle,
    attributes,
    meta,
    saved,
    ready: () => ready?.(),
    click: () => events.click?.(),
    emit: (name, event = {}) => windowEvents[name]?.(event),
  };
}

test("keeps the existing dark theme by default and initializes the accessible switch", () => {
  const page = render();
  assert.equal(page.root.dataset.theme, "dark");
  assert.equal(page.meta.content, "#000000");
  assert.equal(page.toggle.hidden, true);
  page.ready();
  assert.equal(page.toggle.hidden, false);
  assert.equal(page.attributes["aria-checked"], "false");
  assert.equal(page.saved.size, 0);
});

test("restores a saved light theme before the page is ready", () => {
  const page = render({ saved: "light" });
  assert.equal(page.root.dataset.theme, "light");
  assert.equal(page.meta.content, "#f5f7fb");
  assert.equal(page.toggle.hidden, true);
  page.ready();
  assert.equal(page.attributes["aria-checked"], "true");
});

test("switches both ways and remembers the choice on another page", () => {
  const page = render({ ready: true });
  page.click();
  assert.equal(page.root.dataset.theme, "light");
  assert.equal(page.attributes["aria-checked"], "true");
  assert.equal(page.meta.content, "#f5f7fb");
  assert.equal(page.saved.get("tim-theme"), "light");
  const next = render({ saved: page.saved.get("tim-theme"), ready: true });
  assert.equal(next.root.dataset.theme, "light");
  next.click();
  assert.equal(next.root.dataset.theme, "dark");
  assert.equal(next.attributes["aria-checked"], "false");
  assert.equal(next.meta.content, "#000000");
  assert.equal(next.saved.get("tim-theme"), "dark");
});

test("follows a theme change made in another tab or on a restored page", () => {
  const page = render({ ready: true });
  assert.equal(page.root.dataset.theme, "dark");

  // Een andere browser-tab schrijft een nieuwe voorkeur.
  page.saved.set("tim-theme", "light");
  page.emit("storage", { key: "tim-theme" });
  assert.equal(page.root.dataset.theme, "light");
  assert.equal(page.attributes["aria-checked"], "true");
  assert.equal(page.meta.content, "#f5f7fb");

  // Een andere sleutel mag de voorkeur niet overschrijven.
  page.saved.set("tim-theme", "dark");
  page.emit("storage", { key: "andere-sleutel" });
  assert.equal(page.root.dataset.theme, "light");

  // Een pagina uit de back/forward-cache wordt opnieuw toegepast.
  page.emit("pageshow");
  assert.equal(page.root.dataset.theme, "dark");
  assert.equal(page.attributes["aria-checked"], "false");
});

test("sync keeps working when storage is blocked", () => {
  const page = render({ blocked: true, ready: true });
  assert.doesNotThrow(() => page.emit("storage", { key: "tim-theme" }));
  assert.doesNotThrow(() => page.emit("pageshow"));
  assert.equal(page.root.dataset.theme, "dark");
  page.click();
  assert.equal(page.root.dataset.theme, "light");
});

test("ignores invalid saved preferences", () => {
  for (const saved of ["dark", "invalid", "", "LIGHT"]) {
    assert.equal(render({ saved }).root.dataset.theme, "dark");
  }
});

test("switching still works when browser storage is blocked or cannot be written", () => {
  for (const options of [{ blocked: true }, { readOnly: true }]) {
    const page = render({ ...options, ready: true });
    page.click();
    assert.equal(page.root.dataset.theme, "light");
    assert.equal(page.attributes["aria-checked"], "true");
    page.click();
    assert.equal(page.root.dataset.theme, "dark");
  }
});

test("missing optional metadata or switch does not break the page", () => {
  assert.doesNotThrow(() => render({ noToggle: true, ready: true }));
  const page = render({ noMeta: true, ready: true });
  assert.doesNotThrow(() => page.click());
  assert.equal(page.root.dataset.theme, "light");
});
