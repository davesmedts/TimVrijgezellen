import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createSiteServer } from "../scripts/serve.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
async function files(directory, extension) {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(entries.map((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? files(path, extension) : extname(path) === extension ? [path] : [];
  }));
  return groups.flat();
}
const htmlFiles = await files(resolve(root, "docs"), ".html");
const markdownFiles = await files(resolve(root, "Bestemmingen"), ".md");

test("website links, fragment targets, landmarks, and navigation", async () => {
  for (const path of htmlFiles) {
    const html = await readFile(path, "utf8");
    assert.match(html, /<!doctype html>/i, path);
    assert.match(html, /<html lang="nl">/, path);
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, path);
    assert.equal((html.match(/<main[\s>]/g) ?? []).length, 1, path);
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1, path);
    assert.match(html, /<meta name="viewport"/, path);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, `Duplicate id in ${path}`);

    for (const match of html.matchAll(/<(?:a|link|script|iframe)\b[^>]*(?:href|src)="([^"]+)"[^>]*>/g)) {
      const tag = match[0];
      const link = match[1].replaceAll("&amp;", "&");
      if (/target="_blank"/.test(tag)) assert.match(tag, /rel="noopener noreferrer"/, path);
      if (/^(?:https?:|mailto:)/.test(link)) continue;
      assert.ok(!link.startsWith("/"), `Root-relative link breaks GitHub Pages: ${link}`);
      const [filename, fragment] = link.split("#");
      const target = filename ? resolve(dirname(path), filename.split("?")[0]) : path;
      assert.ok((await stat(target)).isFile(), `Missing link ${link} in ${path}`);
      if (fragment) assert.match(await readFile(target, "utf8"), new RegExp(`\\bid="${fragment}"`), link);
    }

    for (const destination of htmlFiles.filter((file) => dirname(file).endsWith("bestemmingen"))) {
      assert.ok(html.includes(destination.split(/[\\/]/).at(-1)), `Navigation missing ${destination} in ${path}`);
    }
  }
});

test("destination cost cards add up and exclude spending/reserve", async () => {
  for (const path of htmlFiles.filter((file) => dirname(file).endsWith("bestemmingen"))) {
    const html = await readFile(path, "utf8");
    assert.match(html, /id="kosten"/, path);
    const budget = html.match(/<dl class="budget-list">([\s\S]*?)<\/dl>/)?.[1];
    assert.ok(budget, path);
    assert.doesNotMatch(budget, /reserve|nachtleven|party|eten|drank/i, path);
    const rows = [...budget.matchAll(/data-min="([\d.]+)" data-max="([\d.]+)"[^>]*><dt>[^<]*<\/dt><dd>([^<]+)<\/dd>/g)];
    assert.ok(rows.length > 2, path);
    const values = (text) => [...text.matchAll(/\d+(?:,\d+)?/g)].map(([amount]) => Number(amount.replace(",", ".")));
    for (const row of rows) {
      const displayed = values(row[3]);
      assert.equal(displayed.length, 1 + (Number(row[1]) !== Number(row[2]) ? 1 : 0), `Unexpected displayed range in ${path}: ${row[3]}`);
      assert.ok(Math.abs(displayed[0] - Number(row[1])) < 0.5, `Displayed minimum differs from checked value in ${path}: ${row[3]}`);
      assert.ok(Math.abs(displayed.at(-1) - Number(row[2])) < 0.5, `Displayed maximum differs from checked value in ${path}: ${row[3]}`);
    }
    const total = budget.match(/data-total-min="([\d.]+)" data-total-max="([\d.]+)"/);
    assert.ok(total, path);
    for (const index of [1, 2]) {
      const sum = rows.reduce((value, row) => value + Number(row[index]), 0);
      assert.equal(Math.round(sum), Number(total[index]), `Wrong total in ${path}`);
    }
    const displayedTotal = budget.match(/class="budget-total"[^>]*><dt>[^<]*<\/dt><dd>([^<]+)<\/dd>/)?.[1];
    assert.deepEqual(values(displayedTotal), [Number(total[1]), Number(total[2])], `Displayed total differs from checked values in ${path}`);
    assert.match(html, /Richtprijzen|geen offerte|geen bevestigde boekingen/, path);
    assert.match(html, /class="sun-summary"/, path);
    assert.doesNotMatch(html, /weather-sun-table/, path);
  }
});

test("every page has a shared, accessible header theme switch with early initialization", async () => {
  for (const path of htmlFiles) {
    const html = await readFile(path, "utf8");
    const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1];
    const script = head.match(/<script src="[^\"]*assets\/theme\.js"><\/script>/)?.[0];
    assert.ok(script, `Theme must initialize before rendering in ${path}`);
    assert.ok(head.indexOf(script) < head.indexOf('<link rel="stylesheet"'), path);
    assert.equal((html.match(/data-theme-toggle/g) ?? []).length, 1, path);
    const header = html.match(/<header class="site-header">([\s\S]*?)<\/header>/)?.[1];
    const toggle = header.match(/<button\b[^>]*data-theme-toggle[^>]*>/)?.[0];
    assert.ok(toggle, `Theme switch missing from header in ${path}`);
    for (const attribute of ['type="button"', 'role="switch"', 'aria-checked="false"', 'aria-label="Lichte modus"', "hidden"]) {
      assert.ok(toggle.includes(attribute), `Missing ${attribute} in ${path}`);
    }
    const control = header.match(/<button\b[^>]*data-theme-toggle[^>]*>([\s\S]*?)<\/button>/)?.[1];
    assert.match(control, /theme-toggle__icon--sun/, `Sun icon missing in ${path}`);
    assert.match(control, /theme-toggle__icon--moon/, `Moon icon missing in ${path}`);
    assert.doesNotMatch(control, /theme-toggle__track|theme-toggle__thumb|>\s*(?:licht|donker)\s*</i, `Visible label or slider remains in ${path}`);
  }
});

test("overview has no destination estimates and keeps the two remaining destinations", async () => {
  const html = await readFile(resolve(root, "docs/index.html"), "utf8");
  const cards = [...html.matchAll(/<a class="destination-card[\s\S]*?<\/a>/g)];
  assert.equal(cards.length, 2);
  for (const [card] of cards) assert.doesNotMatch(card, /€|raming/i);
  const overview = await readFile(resolve(root, "Bestemmingen/overzicht.md"), "utf8");
  assert.doesNotMatch(overview, /Hostelbasis|Hotelbasis|Budgetinterpretatie/);
});

test("cost comparison starts with destination budgets matching the detail pages", async () => {
  const html = await readFile(resolve(root, "docs/kosten.html"), "utf8");
  const expected = {
    lissabon: [345, 486],
    amsterdam: [314, 324],
  };
  const sums = Object.fromEntries(Object.keys(expected).map((city) => [city, [0, 0]]));
  const items = [...html.matchAll(/<input type="checkbox" data-cost-item="([^"]+)" data-city="([^"]+)"[^>]*data-min="([\d.]+)" data-max="([\d.]+)"([^>]*)>/g)];
  assert.ok(items.length >= 14, "Expected the current transport, stay, and activity estimates");

  for (const item of items) {
    const [, , city, minimum, maximum, attributes] = item;
    assert.ok(sums[city], `Unknown cost comparison destination: ${city}`);
    assert.ok(Number(minimum) <= Number(maximum), `Invalid range in ${item[0]}`);
    if (/\bchecked\b/.test(attributes)) {
      sums[city][0] += Number(minimum);
      sums[city][1] += Number(maximum);
    }
  }

  for (const [city, range] of Object.entries(expected)) {
    assert.deepEqual(sums[city].map(Math.round), range, `Default selection no longer matches ${city}`);
    assert.match(html, new RegExp(`data-total-city="${city}"[\\s\\S]*?${range[0]}–${range[1]} p\\.p\\.`));
    assert.match(html, new RegExp(`data-total-city="${city}"[\\s\\S]*?data-total-group`));
  }

  assert.match(html, /Activiteit 1[\s\S]*Activiteit 4/);
  assert.match(html, /data-tooltip="A’DAM VR Level 2 Action/);
  assert.match(html, /data-tooltip="Kajak en snorkel/);
  assert.match(html, /class="cost-unknown"/);
  assert.match(html, /data-cost-item="lissabon-splash-boat".*?data-exclusive-group="lissabon-saturday"/);
  assert.match(html, /data-cost-item="amsterdam-bunk-hotel"/);
  assert.match(html, /data-cost-item="amsterdam-bunk-parking"/);
  assert.doesNotMatch(html, /data-cost-item="amsterdam-(?:hostel|budgethotel|bunk)"/);
  assert.match(html, /data-reset-costs/);
  assert.match(html, /aria-live="polite"/);
  const comparisonTable = html.match(/<table class="cost-comparison"[\s\S]*?<\/table>/)?.[0] ?? "";
  const rowLabels = [...comparisonTable.matchAll(/<th scope="row">([^<]+)/g)].map(([, label]) => label);
  assert.doesNotMatch(rowLabels.join(" "), /reserve|nachtleven|eten|drank/i);
});

test("Markdown tables have consistent columns and three-scenario totals add up", async () => {
  for (const path of markdownFiles) {
    const markdown = await readFile(path, "utf8");
    assert.doesNotMatch(markdown, /^\|\s*Reserve/m, path);
    const tables = markdown.match(/(?:^\|.*\|\r?\n?)+/gm) ?? [];
    for (const table of tables) {
      const rows = table.trim().split(/\r?\n/).map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
      for (const row of rows) assert.equal(row.length, rows[0].length, `Column mismatch in ${path}`);
      if (rows[0].join("|") !== "Onderdeel|Minimum|Realistisch|Maximum") continue;
      const amounts = (row) => row.slice(1).map((cell) => {
        const amount = cell.match(/€([\d.,]+)/)?.[1];
        assert.ok(amount, `Missing amount in ${path}: ${row}`);
        return Number(amount.replaceAll(".", "").replace(",", "."));
      });
      // Optellen in drijvende komma levert soms een ulp verschil op; reken af op een cent.
      const addsUp = (row, expected) => {
        const actual = amounts(row);
        assert.equal(actual.length, expected.length, `Wrong number of amounts in ${path}: ${row[0]}`);
        for (const [index, value] of actual.entries()) {
          assert.ok(Math.abs(value - expected[index]) < 0.01, `Incorrect budget in ${path}: ${row[0]}: ${value} versus ${expected[index]}`);
        }
      };
      const components = rows.slice(2).filter((row) => !row[0].includes("Totaal"));
      for (const row of rows.filter((item) => item[0].includes("Totaal"))) {
        const hostel = row[0].includes("hostel");
        const hotel = row[0].includes("budgethotel");
        if (!hostel && !hotel) {
          const before = rows.slice(2, rows.indexOf(row));
          const included = before.filter((item) => !item[0].includes("Totaal"));
          const expected = included.reduce((sum, item) => amounts(item).map((value, index) => value + sum[index]), [0, 0, 0]);
          addsUp(row, expected);
          continue;
        }
        const included = components.filter((item) => !(hostel && item[0].includes("budgethotel")) && !(hotel && item[0].includes("hostel")));
        const expected = included.reduce((sum, item) => amounts(item).map((value, index) => value + sum[index]), [0, 0, 0]);
        addsUp(row, expected);
      }
    }
  }
});

test("Markdown local links and archived research JSON remain valid", async () => {
  const allMarkdown = [...markdownFiles, resolve(root, "README.md"), resolve(root, "vrijgezellen.md"), resolve(root, "docs/README.md")];
  for (const path of allMarkdown) {
    const markdown = await readFile(path, "utf8");
    for (const match of markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const link = match[1];
      if (/^(?:https?:|#|mailto:)/.test(link)) continue;
      const target = resolve(dirname(path), link.split("#")[0]);
      assert.ok((await stat(target)).isFile(), `Missing Markdown link ${link} in ${path}`);
    }
  }
  const researchJson = await readFile(resolve(root, "laliga-matches.json"), "utf8");
  assert.doesNotThrow(() => JSON.parse(researchJson));
});

test("key content regressions stay fixed", async () => {
  const lisbon = await readFile(resolve(root, "docs/bestemmingen/lissabon.html"), "utf8");
  assert.match(lisbon, /06:56/);
  assert.doesNotMatch(lisbon, /07:56/);
  assert.match(lisbon, /23:55/);
  assert.match(lisbon, /nog niet zondagavond thuis/);
  const amsterdam = await readFile(resolve(root, "docs/bestemmingen/amsterdam.html"), "utf8");
  assert.match(amsterdam, /A’DAM VR Level 2 Action/);
  assert.match(amsterdam, /Prison Island/);
  assert.match(amsterdam, /zondagvoormiddag is nog niet ingevuld/i);
  assert.match(amsterdam, /naar zondag worden verplaatst/);
  const css = await readFile(resolve(root, "docs/assets/styles.css"), "utf8");
  assert.match(css, /a:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /@media print/);
});

test("local server serves only the site, handles HEAD and missing pages", async () => {
  const server = createSiteServer();
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    const page = await fetch(url);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type"), /text\/html/);
    assert.match(await page.text(), /Vrijgezellen Tim/);
    assert.equal((await fetch(`${url}/assets/styles.css`, { method: "HEAD" })).status, 200);
    assert.equal((await fetch(`${url}/missing.html`)).status, 404);
    assert.equal((await fetch(`${url}/index.html`, { method: "POST" })).status, 405);
    assert.equal((await fetch(`${url}/..%5Cpackage.json`)).status, 403);
  } finally {
    await new Promise((done) => server.close(done));
  }
});
