import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const source = await readFile(new URL("../docs/assets/countdown.js", import.meta.url), "utf8");
const target = "2027-04-16T17:00:00+02:00";

function render(now, options = {}) {
  const nodes = Object.fromEntries(["[data-days]", "[data-hours]", "[data-minutes]", "[data-seconds]", ".countdown-intro > p:last-child"].map((key) => [key, { textContent: "--" }]));
  let tick;
  let cleared = false;
  let clock = now;
  const container = {
    dataset: { target: options.target ?? target },
    querySelector: (selector) => options.missingNode === selector ? null : nodes[selector],
  };
  runInNewContext(source, {
    document: { querySelector: () => options.noContainer ? null : container },
    Date: { parse: Date.parse, now: () => clock },
    window: {
      setInterval: (callback) => { tick = callback; return 1; },
      clearInterval: () => { cleared = true; },
    },
  });
  return { nodes, scheduled: Boolean(tick), advance: (time) => { clock = time; tick?.(); return cleared; } };
}

test("countdown renders days, hours, minutes, and seconds in the correct timezone", () => {
  const result = render(Date.parse(target) - (2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000);
  assert.equal(result.nodes["[data-days]"].textContent, "002");
  assert.equal(result.nodes["[data-hours]"].textContent, "03");
  assert.equal(result.nodes["[data-minutes]"].textContent, "04");
  assert.equal(result.nodes["[data-seconds]"].textContent, "05");
  assert.equal(result.scheduled, true);
});

test("countdown stops at departure, never displays negative values", () => {
  const result = render(Date.parse(target) - 1000);
  assert.equal(result.advance(Date.parse(target)), true);
  assert.equal(result.nodes["[data-days]"].textContent, "00");
  assert.equal(result.nodes[".countdown-intro > p:last-child"].textContent, "Het weekend is begonnen!");
  assert.equal(render(Date.parse(target) + 1000).scheduled, false);
});

test("missing elements and invalid dates do not throw or schedule a timer", () => {
  assert.equal(render(Date.now(), { noContainer: true }).scheduled, false);
  assert.equal(render(Date.now(), { target: "invalid" }).scheduled, false);
  assert.equal(render(Date.now(), { missingNode: "[data-seconds]" }).scheduled, false);
});
