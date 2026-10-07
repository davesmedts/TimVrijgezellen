import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createSiteServer } from "./serve.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const artifacts = resolve(root, ".review-artifacts");
const candidates = [
  process.env.BROWSER_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);
const executable = candidates.find(existsSync);
if (!executable) throw new Error("No Chromium browser found. Set BROWSER_PATH to Chrome or Edge.");

await mkdir(artifacts, { recursive: true });
const server = createSiteServer();
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = spawn(executable, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--remote-debugging-port=0", `--user-data-dir=${resolve(artifacts, "browser-profile")}`,
  "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });

let socket;
const pending = new Map();
let nextId = 0;
let browserSession;
const exceptions = [];

function send(method, params = {}, sessionId = browserSession) {
  return new Promise((accept, reject) => {
    const id = ++nextId;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(id, { accept, reject, timeout });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}

const audit = () => {
  const issues = [];
  const width = window.innerWidth;
  const report = (condition, message) => { if (!condition) issues.push(message); };
  report(document.documentElement.scrollWidth <= width + 1, `Page overflows: ${document.documentElement.scrollWidth}px > ${width}px`);
  if (document.documentElement.scrollWidth > width + 1) {
    const overflowing = [...document.querySelectorAll("body *")].filter((element) => !element.closest('.ambient, .comparison-table-scroll') && element.getBoundingClientRect().right > width + 1);
    issues.push(`Overflowing elements: ${overflowing.slice(0, 6).map((element) => `${element.tagName}.${element.className}`).join(', ')}`);
  }
  report(document.querySelectorAll("h1").length === 1, "Expected one h1");
  report(document.querySelectorAll('[aria-current="page"]').length === 1, "Expected one active navigation link");
  const theme = document.documentElement.dataset.theme;
  const toggle = document.querySelector("[data-theme-toggle]");
  report(["dark", "light"].includes(theme), "Theme did not initialize");
  report(toggle && !toggle.hidden && toggle.getAttribute("role") === "switch", "Theme switch missing or hidden");
  if (toggle) {
    report(toggle.getAttribute("aria-checked") === String(theme === "light"), "Theme switch state is incorrect");
    const shownIcon = theme === "light" ? ".theme-toggle__icon--moon" : ".theme-toggle__icon--sun";
    const hiddenIcon = theme === "light" ? ".theme-toggle__icon--sun" : ".theme-toggle__icon--moon";
    report(getComputedStyle(toggle.querySelector(shownIcon)).display !== "none", `Expected ${theme} mode icon is hidden`);
    report(getComputedStyle(toggle.querySelector(hiddenIcon)).display === "none", `Unexpected theme icon is visible in ${theme} mode`);
    const bounds = toggle.getBoundingClientRect();
    report(bounds.width >= 44 && bounds.height >= 44 && bounds.right <= width && bounds.left >= 0, "Theme switch must be visible with a 44px touch target");
    toggle.focus();
    report(getComputedStyle(toggle).outlineStyle !== "none", "Theme switch keyboard focus outline missing");
  }
  report(document.querySelector('meta[name="theme-color"]').content === (theme === "light" ? "#f5f7fb" : "#000000"), "Browser theme color did not update");
  report(window.localStorage.getItem("tim-theme") === theme, "Theme choice was not saved");

  const clipped = [...document.querySelectorAll("main p, main h1, main h2, main h3, main dd, main dt, main strong, .tabs a")]
    .filter((element) => element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 2)
    .map((element) => `${element.tagName}.${element.className}: ${element.textContent.trim().slice(0, 60)}`);
  report(clipped.length === 0, `Clipped content: ${clipped.join("; ")}`);
  const focusTarget = document.querySelector(".hero-actions a, .quick-strip a, .comparison-reset");
  focusTarget?.focus();
  if (focusTarget) report(getComputedStyle(focusTarget).outlineStyle !== "none", "Keyboard focus outline missing");

  const budget = document.querySelector(".budget-card");
  if (budget) {
    const rows = [...budget.querySelectorAll("[data-min]")];
    const total = budget.querySelector("[data-total-min]");
    report(Math.round(rows.reduce((sum, row) => sum + Number(row.dataset.min), 0)) === Number(total.dataset.totalMin), "Minimum budget does not add up");
    report(Math.round(rows.reduce((sum, row) => sum + Number(row.dataset.max), 0)) === Number(total.dataset.totalMax), "Maximum budget does not add up");
    report(!/reserve|party|nachtleven|eten|drank/i.test(budget.querySelector(".budget-list").textContent), "Excluded spending in cost table");
    report(document.querySelectorAll(".sun-summary dt").length === 2, "Missing sunrise/sunset summary");
    if (width <= 900) report(getComputedStyle(document.querySelector(".detail-aside")).order === "-1", "Mobile costs should precede detailed content");
  }
  const comparison = document.querySelector("[data-cost-comparison]");
  if (comparison) {
    const scroller = document.querySelector(".comparison-table-scroll");
    report(Boolean(scroller), "Cost comparison scroll region missing");
    if (width <= 900) report(scroller.scrollWidth > scroller.clientWidth, "Cost comparison should scroll horizontally on narrow screens");
    if (width >= 1440) report(scroller.scrollWidth <= scroller.clientWidth + 1, "Cost comparison should show all destinations on wide screens");
    const total = document.querySelector('[data-total-city="lissabon"] [data-total-per-person]');
    const firstItem = comparison.querySelector('[data-cost-item="lissabon-flight"]');
    if (total && firstItem) {
      const baseline = total.textContent;
      firstItem.checked = !firstItem.checked;
      firstItem.dispatchEvent(new Event("change", { bubbles: true }));
      report(total.textContent !== baseline, "Toggling a cost did not update its destination total");
      firstItem.checked = !firstItem.checked;
      firstItem.dispatchEvent(new Event("change", { bubbles: true }));
      report(total.textContent === baseline, "Restoring a cost did not restore the destination total");
    }
    const lissabonBoat = comparison.querySelector('[data-cost-item="lissabon-splash-boat"]');
    const lissabonKayak = comparison.querySelector('[data-cost-item="lissabon-kayak"]');
    const lissabonTotal = comparison.querySelector('[data-total-city="lissabon"] [data-total-per-person]');
    if (lissabonBoat && lissabonKayak && lissabonTotal) {
      lissabonKayak.checked = true;
      lissabonKayak.dispatchEvent(new Event("change", { bubbles: true }));
      report(!lissabonBoat.checked, "Selecting the Lisbon kayak should replace the Saturday boat party");
      report(lissabonTotal.textContent.includes("€356–537"), "The Lisbon kayak should reprice the destination total");
      lissabonBoat.checked = true;
      lissabonBoat.dispatchEvent(new Event("change", { bubbles: true }));
      report(!lissabonKayak.checked, "Restoring the boat party should deselect the Lisbon kayak");
      report(lissabonTotal.textContent.includes("€345–486"), "Restoring the boat party should restore the Lisbon total");
    }
    const amsterdamHostel = comparison.querySelector('[data-cost-item="amsterdam-heart-hostel"]');
    const amsterdamHotel = comparison.querySelector('[data-cost-item="amsterdam-bunk-hotel"]');
    const amsterdamParking = comparison.querySelector('[data-cost-item="amsterdam-bunk-parking"]');
    const amsterdamTotal = comparison.querySelector('[data-total-city="amsterdam"] [data-total-per-person]');
    if (amsterdamHostel && amsterdamHotel && amsterdamParking && amsterdamTotal) {
      amsterdamHostel.checked = true;
      amsterdamHostel.dispatchEvent(new Event("change", { bubbles: true }));
      report(!amsterdamHotel.checked && !amsterdamParking.checked, "Selecting the Amsterdam hostel should replace the BUNK stay and its parking");
      report(amsterdamTotal.textContent.includes("€236–246"), "The Amsterdam hostel should reprice the destination total");
      amsterdamHotel.checked = true;
      amsterdamHotel.dispatchEvent(new Event("change", { bubbles: true }));
      report(!amsterdamHostel.checked, "Restoring the BUNK hotel should deselect the Amsterdam hostel");
      amsterdamParking.checked = true;
      amsterdamParking.dispatchEvent(new Event("change", { bubbles: true }));
      report(amsterdamHotel.checked && amsterdamParking.checked, "Restoring the BUNK parking should keep the BUNK hotel selected");
      report(amsterdamTotal.textContent.includes("€314–324"), "Restoring the BUNK stay should restore the Amsterdam total");
    }
    const info = comparison.querySelector(".cost-info[data-tooltip]");
    if (info) {
      info.click();
      report(!document.querySelector(".comparison-tooltip")?.hidden, "Activity information tooltip did not open");
      info.click();
    }
  }
  const countdown = document.querySelector("[data-countdown]");
  if (countdown) report(!/NaN|---/.test(countdown.querySelector(".countdown-grid").textContent), "Countdown did not initialize");

  const rgb = (color) => color.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
  const luminance = (color) => color.slice(0, 3).map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const lowContrast = [];
  for (const element of document.querySelectorAll("body *")) {
    if (!element.getClientRects().length || ![...element.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim())) continue;
    const style = getComputedStyle(element);
    if (element.closest('[aria-hidden="true"]') || style.color === "rgba(0, 0, 0, 0)") continue;
    const ancestors = [];
    for (let current = element; current; current = current.parentElement) ancestors.unshift(current);
    let background = [0, 0, 0];
    for (const ancestor of ancestors) {
      const color = rgb(getComputedStyle(ancestor).backgroundColor);
      const alpha = color[3] ?? 1;
      background = background.map((channel, index) => color[index] * alpha + channel * (1 - alpha));
    }
    const light = [luminance(rgb(style.color)), luminance(background)].sort((a, b) => a - b);
    const ratio = (light[1] + 0.05) / (light[0] + 0.05);
    const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
    if (ratio < (large ? 3 : 4.5)) lowContrast.push(`${element.tagName}.${element.className} ${ratio.toFixed(2)}: ${element.textContent.trim().slice(0, 45)}`);
  }
  report(lowContrast.length === 0, `Low text contrast: ${lowContrast.join("; ")}`);
  return { width, theme, issues, contentHeight: document.body.scrollHeight };
};

async function navigate(page) {
  const loaded = new Promise((done, reject) => {
    const timeout = setTimeout(() => { socket.removeEventListener("message", listener); reject(new Error(`Navigation timeout: ${page}`)); }, 15000);
    const listener = ({ data }) => {
      const message = JSON.parse(data);
      if (message.sessionId === browserSession && message.method === "Page.loadEventFired") {
        clearTimeout(timeout); socket.removeEventListener("message", listener); done();
      }
    };
    socket.addEventListener("message", listener);
  });
  await send("Page.navigate", { url: `${baseUrl}/${page}` });
  await loaded;
}

try {
  const endpoint = await new Promise((accept, reject) => {
    let output = "";
    const timeout = setTimeout(() => reject(new Error("Browser did not start within 20 seconds")), 20000);
    browser.stderr.on("data", (data) => {
      output += data;
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) { clearTimeout(timeout); accept(match[1]); }
    });
    browser.once("error", (error) => { clearTimeout(timeout); reject(error); });
    browser.once("exit", (code) => { clearTimeout(timeout); reject(new Error(`Browser exited (${code}): ${output.slice(-1000)}`)); });
  });
  socket = new WebSocket(endpoint);
  await new Promise((accept, reject) => { socket.addEventListener("open", accept, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails.text);
    const request = pending.get(message.id);
    if (!request) return;
    clearTimeout(request.timeout);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.accept(message.result);
  });

  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  browserSession = sessionId;
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  // Offline third-party resources keep layout tests deterministic and avoid network/certificate failures.
  await send("Network.setBlockedURLs", { urls: ["*maps.google.com*", "*fonts.googleapis.com*", "*fonts.gstatic.com*"] });
  const { identifier } = await send("Page.addScriptToEvaluateOnNewDocument", { source: 'window.localStorage.removeItem("tim-theme"); window.localStorage.removeItem("tim-cost-comparison-v1");' });

  const results = [];
  let firstLoad = true;
  for (const page of ["index.html", "kosten.html", "bestemmingen/lissabon.html", "bestemmingen/amsterdam.html"]) {
    for (const width of [320, 390, 768, 1024, 1440]) {
      await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await navigate(page);
      if (firstLoad) {
        await send("Page.removeScriptToEvaluateOnNewDocument", { identifier });
        firstLoad = false;
      }
      const restored = await send("Runtime.evaluate", { expression: 'document.documentElement.dataset.theme === (window.localStorage.getItem("tim-theme") ?? "dark")', returnByValue: true });
      if (!restored.result.value) exceptions.push(`Saved theme did not restore: ${page} @ ${width}px`);
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
      const keyboard = await send("Runtime.evaluate", { expression: '({ skip: document.activeElement.classList.contains("skip-link"), outline: getComputedStyle(document.activeElement).outlineStyle })', returnByValue: true });
      for (const theme of ["dark", "light"]) {
        if (theme === "dark") {
          await send("Runtime.evaluate", { expression: 'if (document.documentElement.dataset.theme !== "dark") document.querySelector("[data-theme-toggle]").click(); else window.localStorage.setItem("tim-theme", "dark");' });
        } else {
          await send("Runtime.evaluate", { expression: 'document.querySelector("[data-theme-toggle]").focus();' });
          await send("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
          await send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
        }
        // Audit the settled theme rather than intermediate colors during CSS transitions.
        await send("Runtime.evaluate", { expression: 'new Promise((done) => requestAnimationFrame(() => Promise.all(document.getAnimations().filter((animation) => animation.effect.getTiming().iterations !== Infinity).map((animation) => animation.finished.catch(() => {}))).then(done)))', awaitPromise: true });
        const { result } = await send("Runtime.evaluate", { expression: `(${audit.toString()})()`, returnByValue: true });
        const report = { page, ...result.value };
        if (report.theme !== theme) report.issues.push(`Theme switch failed: expected ${theme}`);
        if (!keyboard.result.value.skip || keyboard.result.value.outline === "none") report.issues.push("Tab must reach a visible skip link first");
        results.push(report);
        console.log(`${report.issues.length ? "FAIL" : "PASS"} ${page} @ ${width}px (${theme})${report.issues.length ? `\n  ${report.issues.join("\n  ")}` : ""}`);
        if ([390, 1440].includes(width)) {
          const suffix = theme === "light" ? "-light" : "";
          await send("Runtime.evaluate", { expression: 'document.activeElement?.blur(); window.scrollTo({ top: 0, behavior: "instant" });' });
          const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
          await writeFile(resolve(artifacts, `${page.replaceAll("/", "-")}-${width}${suffix}.png`), Buffer.from(data, "base64"));
          await send("Runtime.evaluate", { expression: 'document.querySelector("#kosten, #bestemmingen, [data-cost-comparison]")?.scrollIntoView({ behavior: "instant" });' });
          const section = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
          await writeFile(resolve(artifacts, `${page.replaceAll("/", "-")}-${width}${suffix}-details.png`), Buffer.from(section.data, "base64"));
        }
      }
    }
  }
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  const reduced = await send("Runtime.evaluate", { expression: 'getComputedStyle(document.querySelector(".status-dot")).animationName', returnByValue: true });
  if (reduced.result.value !== "none") exceptions.push("Reduced-motion preference was not respected");
  await send("Emulation.setEmulatedMedia", { media: "print" });
  for (const theme of ["light", "dark"]) {
    if (theme === "dark") await send("Runtime.evaluate", { expression: 'document.querySelector("[data-theme-toggle]").click();' });
    const print = await send("Runtime.evaluate", { expression: '({ header: getComputedStyle(document.querySelector(".site-header")).display, amount: getComputedStyle(document.querySelector(".budget-amount, .destination-total strong")).color })', returnByValue: true });
    if (print.result.value.header !== "none" || print.result.value.amount !== "rgb(17, 17, 17)") exceptions.push(`Print layout failed (${theme}): header or cost text`);
  }
  await writeFile(resolve(artifacts, "browser-review.json"), JSON.stringify({ results, exceptions }, null, 2));
  if (results.some((result) => result.issues.length) || exceptions.length) process.exitCode = 1;
  console.log(`Screenshots and report: ${artifacts}`);
} finally {
  try { if (socket?.readyState === WebSocket.OPEN) await send("Browser.close", {}, undefined); } catch { browser.kill(); }
  socket?.close();
  for (const request of pending.values()) clearTimeout(request.timeout);
  await new Promise((done) => server.close(done));
}
