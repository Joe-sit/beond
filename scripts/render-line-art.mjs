// Export the landing hero's illustration pieces (LoginPage, Figma 379:849) as
// separate PNGs for LINE Flex. Flex can't render SVG and has no transform, so
// each piece is rasterised with its rotate/skew already baked in; the message
// then positions them itself with absolute boxes.
//
// Run: node scripts/render-line-art.mjs   → public/illustration/*.png
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "public/illustration");
const dataUri = (f) =>
  `data:image/svg+xml;base64,${readFileSync(resolve(root, "src/assets", f)).toString("base64")}`;

// width = the on-page lg size; transform = the same one LoginPage applies.
const PIECES = [
  { name: "money-bill", file: "landing-money-bill.svg", width: 300, transform: "none" },
  { name: "coins", file: "landing-coins.svg", width: 240, transform: "none" },
  {
    name: "slip-back",
    file: "landing-slip-back.svg",
    width: 520,
    transform: "rotate(41deg) skewX(-22deg) scaleY(0.92)",
  },
  {
    name: "slip-front",
    file: "landing-slip-front.svg",
    width: 560,
    transform: "rotate(33deg) skewX(-22deg) scaleY(0.92)",
  },
];

const browser = await chromium.launch();
mkdirSync(outDir, { recursive: true });

for (const p of PIECES) {
  const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1200, height: 1200 } });
  // The wrapper is what gets shot: a transformed element's own box doesn't grow
  // to cover the rotated result, so the rotation would be clipped at the edges.
  await page.setContent(`<!doctype html><meta charset="utf-8">
    <style>html,body{margin:0;background:transparent}
      #w{display:inline-block;padding:80px}
      img{display:block;width:${p.width}px;transform:${p.transform}}</style>
    <div id="w"><img src="${dataUri(p.file)}"></div>`);
  await page.waitForLoadState("networkidle");

  // Trim the padding back off by shooting the union of the image's painted box.
  const box = await page.locator("img").evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  await page.screenshot({
    path: resolve(outDir, `${p.name}.png`),
    clip: box,
    omitBackground: true,
  });
  await page.close();
  console.log(`${p.name}.png  ${Math.round(box.width)}x${Math.round(box.height)}`);
}

await browser.close();
