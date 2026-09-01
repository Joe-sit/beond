// Photograph the extension for its Chrome Web Store listing.
//
// The store wants 1280x800 shots of the real UI. Loading an unpacked MV3
// extension into headless Chromium is unreliable, so instead the REAL popup and
// the REAL content script are run as ordinary page code with `chrome.storage`
// stubbed — same markup, same CSS, same layout code, no mock UI.
//
// The panel is photographed over extension/store/demo-form.html, a plain form
// that labels itself a demo: efiling.rd.go.th cannot be scripted here, and a
// screenshot must never pass itself off as the Revenue Department's site.
//
//   node scripts/make-store-shots.mjs [outDir]
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const EXT = resolve("extension");
const OUT = resolve(process.argv[2] ?? "extension/store/screenshots");
mkdirSync(OUT, { recursive: true });

/** The worked example shown in every shot. Real shape, invented numbers. */
const ROWS = [
  { issuer_name: "บมจ. บีทีเอส กรุ๊ป โฮลดิ้งส์", issuer_tax_id: "0107536000421", gross_interest: 47830.14, wht_amount: 7174.52 },
  { issuer_name: "บมจ. แสนสิริ", issuer_tax_id: "0107537002460", gross_interest: 38460.0, wht_amount: 5769.0 },
  { issuer_name: "บมจ. บริทาเนีย", issuer_tax_id: "0107563000371", gross_interest: 24120.55, wht_amount: 3618.08 },
];

/** chrome.storage.local, enough of it for the popup and the content script. */
const stub = (seed) => `
  window.__store = ${JSON.stringify(seed)};
  window.chrome = {
    storage: {
      local: {
        // Async on purpose: the real API defers its callback, and the content
        // script relies on that — a synchronous call lands in the middle of its
        // own module initialisation and throws.
        get: (keys, cb) => queueMicrotask(() => {
          const out = {};
          for (const k of [].concat(keys)) if (k in window.__store) out[k] = window.__store[k];
          cb(out);
        }),
        set: (obj, cb) => { Object.assign(window.__store, obj); cb && cb(); },
      },
      onChanged: { addListener: () => {} },
    },
  };
`;

const css = readFileSync(`${EXT}/content/efiling.css`, "utf8");
const auto = readFileSync(`${EXT}/content/autodetect.js`, "utf8");
const conf = readFileSync(`${EXT}/content/confetti.js`, "utf8");
const js = readFileSync(`${EXT}/content/efiling.js`, "utf8");

const browser = await chromium.launch({ args: ["--force-color-profile=srgb"] });

// ── 1 + 2: the panel on a form ─────────────────────────────────────────────
async function panelShots() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    // Two payers, not three: the panel caps at 70vh and scrolls, and a shot of a
  // half-cut panel reads as a broken one.
  await page.addInitScript(stub({ beond_bond_data: ROWS.slice(0, 2) }));
  await page.goto(`file://${EXT}/store/demo-form.html`);
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: auto });
  await page.addScriptTag({ content: conf });
  await page.addScriptTag({ content: js });
  await page.waitForSelector("#beond-efiling-panel .beond-fill-all:not([disabled])");

  // Shot 1: every payer filled in one click, with nothing taught to the panel
  // first — the boxes are found by their Thai captions.
  await page.click("#beond-efiling-panel .beond-fill-all");
  // Mid-burst: the confetti is part of what a completed fill looks like.
  await page.waitForTimeout(620);
  await page.screenshot({ path: `${OUT}/01-autofill.png` });

  // Shot 2: teaching the panel which box is which. The fallback tools are
  // folded away by default, so they are opened the way a user would.
  await page.click("#beond-efiling-panel .beond-more");
  await page.waitForSelector("#beond-efiling-panel .beond-map");
  await page.click("#beond-efiling-panel .beond-map");
  // The panel caps at 78vh and scrolls; the tools are what this shot is about.
  await page.$eval("#beond-efiling-panel .beond-panel", (n) => n.scrollTo(0, n.scrollHeight));
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/02-mapping.png` });
  await page.close();
}

// ── 3: the toolbar popup, on a plain ground ────────────────────────────────
async function popupShot() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await page.addInitScript(stub({ beond_bond_data: ROWS, beond_synced_at: "2026-03-14T09:12:00+07:00" }));
  await page.goto(`file://${EXT}/popup/popup.html`);
  await page.waitForSelector("#rows .row");
  // The popup is 318px wide; centre it on the canvas the store expects rather
  // than shipping a 318px screenshot the store will refuse.
  await page.evaluate(() => {
    const shell = document.createElement("div");
    shell.id = "shot-shell";
    shell.style.cssText =
      "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#eef1f6";
    document.body.style.cssText +=
      ";position:relative;z-index:1;margin:auto;border-radius:14px;background:#fff;box-shadow:0 18px 60px rgba(20,26,45,.18)";
    document.documentElement.appendChild(shell);
    shell.appendChild(document.body);
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/03-popup.png` });
  await page.close();
}

await panelShots();
await popupShot();
await browser.close();
console.log("wrote", OUT);
