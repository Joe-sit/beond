// Client-side word-box OCR for the 50-ทวิ scan flow. Tesseract.js reads the
// captured frame and returns every word with a pixel box; `locateFields` then
// finds the four values we care about and the box each one sits in, so the scan
// UI can draw a real detection rectangle over each field as it resolves.
//
// We deliberately capture ONLY: bond symbol, payer tax id, and the money trio
// (gross / wht / net). The payee's national ID is never located or stored.
import Tesseract from "tesseract.js";
import { EMPTY_SLIP, type SlipFields } from "./scanTypes";

export interface OcrWord {
  text: string;
  // Pixel box in the source image.
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  conf: number;
}

export interface OcrResult {
  words: OcrWord[];
  width: number;
  height: number;
}

// A located field: its parsed value + the normalized (0..1) box to highlight.
export interface FieldBox {
  key: FieldKey;
  value: string; // display/edit string (numbers kept as typed digits)
  box: NormBox; // union of the word boxes that make up the value
  conf: number;
}

export type FieldKey = "bond_symbol" | "payer_name" | "payer_tax_id" | "gross_amount" | "wht_amount" | "net_amount";

export interface NormBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ── OCR ─────────────────────────────────────────────────────────────────────

// Recognize a slip image into words + boxes. `onProgress` (0..1) tracks the
// recognize phase so the UI can show a determinate scan.
export interface RecognizeOpts {
  onProgress?: (p: number) => void;
  // True source dimensions (e.g. capture canvas). If omitted we infer the page
  // extent from the word boxes, which is close enough for overlay purposes.
  width?: number;
  height?: number;
}

export async function recognizeBoxes(
  image: Tesseract.ImageLike,
  opts: RecognizeOpts = {},
): Promise<OcrResult> {
  const { onProgress, width, height } = opts;
  const worker = await Tesseract.createWorker(
    "tha+eng",
    1,
    onProgress
      ? {
          logger: (m) => {
            if (m.status === "recognizing text") onProgress(m.progress);
          },
        }
      : undefined,
  );
  try {
    const { data } = await worker.recognize(image, {}, { blocks: true });
    const words = flattenWords(data);
    const W = width || Math.max(1, ...words.map((w) => w.x1));
    const H = height || Math.max(1, ...words.map((w) => w.y1));
    return { words, width: W, height: H };
  } finally {
    await worker.terminate();
  }
}

// Words live under blocks→paragraphs→lines→words in current tesseract.js; older
// builds expose data.words directly. Support both.
function flattenWords(data: Tesseract.Page): OcrWord[] {
  const out: OcrWord[] = [];
  const push = (w: { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }) => {
    const t = w.text?.trim();
    if (!t) return;
    out.push({ text: t, conf: w.confidence, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 });
  };
  const legacy = (data as unknown as { words?: Parameters<typeof push>[0][] }).words;
  if (Array.isArray(legacy) && legacy.length) {
    legacy.forEach(push);
    return out;
  }
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        for (const word of line.words ?? []) push(word);
      }
    }
  }
  return out;
}

// ── Locate the four fields ──────────────────────────────────────────────────

const norm = (w: OcrWord, W: number, H: number): NormBox => ({
  x: w.x0 / W,
  y: w.y0 / H,
  w: (w.x1 - w.x0) / W,
  h: (w.y1 - w.y0) / H,
});

// Digits only, keeping decimal point for money.
const digits = (s: string) => s.replace(/[^\d]/g, "");

// A money amount is a number with EXACTLY two decimals (e.g. 3,590.14). This
// excludes per-unit prices like 14.142466 (6 decimals) that would otherwise be
// mistaken for an amount.
const MONEY_RE = /^\d{1,3}(?:,\d{3})*\.\d{2}$|^\d+\.\d{2}$/;
const moneyVal = (s: string) => {
  const c = s.replace(/[^\d.,]/g, "");
  if (!MONEY_RE.test(c)) return NaN;
  return Number(c.replace(/,/g, ""));
};

// A 13-digit juristic-person tax id starts with 0; a personal national ID
// starts 1–8. We only ever want the payer (a company) → filter to leading 0,
// which also guarantees we never capture the payee's national ID.
//
// A slip can carry several company ids (bank letterhead reg + the payer/issuer),
// so we pick the leading-0 id nearest a "ผู้จ่าย / PAYER" label and away from a
// "ผู้รับ / RECIPIENT" one, falling back to the first if no label reads cleanly.
const centre = (w: OcrWord, W: number, H: number) => ({ x: (w.x0 + w.x1) / 2 / W, y: (w.y0 + w.y1) / 2 / H });
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

function findPayerTaxId(words: OcrWord[], W: number, H: number): FieldBox | null {
  const ids = words.filter((w) => digits(w.text).length === 13 && digits(w.text).startsWith("0"));
  if (!ids.length) return null;
  if (ids.length === 1) {
    const w = ids[0];
    return { key: "payer_tax_id", value: digits(w.text), box: norm(w, W, H), conf: w.conf };
  }

  // The payer id and the payee national id sit paired inside the same label box,
  // while a bank letterhead reg number stands alone up top. So among the
  // leading-0 ids, the payer is the one CLOSEST to a payee id (13 digits, leading
  // 1–8). Thai labels OCR too unreliably to use as a signal.
  const payees = words
    .filter((w) => digits(w.text).length === 13 && /^[1-8]/.test(digits(w.text)))
    .map((w) => centre(w, W, H));
  const nearest = (pts: { x: number; y: number }[], c: { x: number; y: number }) =>
    pts.length ? Math.min(...pts.map((p) => dist(p, c))) : Infinity;

  // No payee id to anchor on → fall back to the first leading-0 id.
  if (!payees.length) {
    const w = ids[0];
    return { key: "payer_tax_id", value: digits(w.text), box: norm(w, W, H), conf: w.conf };
  }
  const scored = ids.map((w) => ({ w, score: nearest(payees, centre(w, W, H)) }));
  scored.sort((a, b) => a.score - b.score);
  const best = scored[0].w;
  return { key: "payer_tax_id", value: digits(best.text), box: norm(best, W, H), conf: best.conf };
}

// Bond symbols read like BTSG28OA / ORI288B / BRI275A: 2–5 caps, 2–3 digits, an
// optional 1–2 letter suffix. Prefer a match that's also a symbol the user holds.
const SYMBOL_RE = /^[A-Z]{2,5}\d{2,3}[A-Z]{0,2}$/;
// OCR routinely confuses O↔0 and I↔1 inside a bond code, so match against the
// portfolio on a canonical form and return the holding's true spelling.
const canonSym = (s: string) => s.replace(/O/g, "0").replace(/I/g, "1");
function findBondSymbol(words: OcrWord[], W: number, H: number, holdings: string[]): FieldBox | null {
  const heldByCanon = new Map(holdings.map((s) => [canonSym(s.toUpperCase()), s.toUpperCase()]));
  let best: FieldBox | null = null;
  for (const w of words) {
    const t = w.text.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!SYMBOL_RE.test(t)) continue;
    const real = heldByCanon.get(canonSym(t));
    if (real) return { key: "bond_symbol", value: real, box: norm(w, W, H), conf: w.conf }; // portfolio match
    const cand: FieldBox = { key: "bond_symbol", value: t, box: norm(w, W, H), conf: w.conf };
    if (!best || cand.box.y < best.box.y) best = cand; // else the topmost candidate
  }
  return best;
}

// The money trio is layout-independent: gross = net + wht, with gross the
// largest and net > wht for a 15% rate. OCR often splits the smallest amount's
// decimal ("424.27" → "424" "27"), so we don't rely on all three being clean:
// we anchor on gross & net (clean 2-decimal amounts) and derive wht = gross-net,
// then locate wht's box by matching the residual digits among nearby tokens.
type Amt = { w: OcrWord; v: number };
function findAmounts(words: OcrWord[], W: number, H: number): FieldBox[] {
  const amounts: Amt[] = words
    .map((w) => ({ w, v: moneyVal(w.text) }))
    .filter((a) => Number.isFinite(a.v) && a.v > 0);
  if (amounts.length < 2) return [];

  const mk = (key: FieldKey, v: number, w: OcrWord): FieldBox => ({
    key,
    value: v.toFixed(2),
    box: norm(w, W, H),
    conf: w.conf,
  });

  // 1) Clean triple: gross ≈ net + wht. A slip repeats amounts (two copies) and
  // OCR adds noise, so MANY spurious triples can satisfy the sum. The reliable
  // discriminator is the withholding rate: interest WHT is 15%, so keep only
  // triples with wht/gross in a sane band and pick the one closest to 15%.
  let bestTriple: { fields: FieldBox[]; rateErr: number } | null = null;
  for (const g of amounts) {
    for (const n of amounts) {
      if (n === g) continue;
      for (const t of amounts) {
        if (t === g || t === n) continue;
        if (Math.abs(g.v - (n.v + t.v)) > 1 || g.v < n.v || g.v < t.v) continue;
        const [net, wht] = n.v >= t.v ? [n, t] : [t, n];
        const rate = wht.v / g.v;
        if (rate < 0.05 || rate > 0.3) continue; // implausible WHT rate → not the trio
        const rateErr = Math.abs(rate - 0.15);
        if (!bestTriple || rateErr < bestTriple.rateErr) {
          bestTriple = {
            rateErr,
            fields: [mk("gross_amount", g.v, g.w), mk("net_amount", net.v, net.w), mk("wht_amount", wht.v, wht.w)],
          };
        }
      }
    }
  }
  if (bestTriple) return bestTriple.fields;

  // 2) Two clean amounts (gross & net) → wht is the difference; find its box.
  const sorted = [...amounts].sort((a, b) => b.v - a.v);
  const gross = sorted[0];
  const net = sorted[1];
  const out = [mk("gross_amount", gross.v, gross.w), mk("net_amount", net.v, net.w)];
  const whtVal = Math.round((gross.v - net.v) * 100) / 100;
  if (whtVal > 0) {
    const whtBox = locateAmountBox(words, whtVal, W, H);
    out.push({
      key: "wht_amount",
      value: whtVal.toFixed(2),
      box: whtBox?.box ?? norm(net.w, W, H),
      conf: whtBox?.conf ?? 0,
    });
  }
  return out;
}

// Find the word box for a known amount whose decimal point OCR may have dropped:
// match the integer part ("424") or the full digit string ("42427").
function locateAmountBox(words: OcrWord[], value: number, W: number, H: number): { box: NormBox; conf: number } | null {
  const intPart = String(Math.floor(value));
  const full = digits(value.toFixed(2));
  let intHit: OcrWord | null = null;
  for (const w of words) {
    const d = digits(w.text);
    if (d === full) return { box: norm(w, W, H), conf: w.conf };
    if (d === intPart && !intHit) intHit = w;
  }
  return intHit ? { box: norm(intHit, W, H), conf: intHit.conf } : null;
}

// Reconstruct text lines by clustering words on a shared baseline (y-centre),
// so a multi-word company name can be matched as one string with a union box.
interface OcrLine {
  words: OcrWord[];
  text: string;
}
function groupLines(words: OcrWord[]): OcrLine[] {
  if (!words.length) return [];
  const heights = words.map((w) => w.y1 - w.y0).sort((a, b) => a - b);
  const medH = heights[Math.floor(heights.length / 2)] || 10;
  const tol = medH * 0.7;
  const byY = [...words].sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2);
  const lines: OcrWord[][] = [];
  for (const w of byY) {
    const yc = (w.y0 + w.y1) / 2;
    const line = lines[lines.length - 1];
    const lastYc = line ? line.reduce((s, x) => s + (x.y0 + x.y1) / 2, 0) / line.length : Infinity;
    if (line && Math.abs(yc - lastYc) <= tol) line.push(w);
    else lines.push([w]);
  }
  return lines.map((ws) => ({
    words: [...ws].sort((a, b) => a.x0 - b.x0),
    text: [...ws].sort((a, b) => a.x0 - b.x0).map((w) => w.text).join(" "),
  }));
}

// The paying company: a "บริษัท … จำกัด (มหาชน)" line that is not a bank. The
// box spans from the "บริษัท" token to the "มหาชน" token on that line.
const COMPANY_RE = /บริษัท.+?จำกัด\s*\(?\s*มหาชน/;
function findCompany(words: OcrWord[], W: number, H: number): FieldBox | null {
  for (const line of groupLines(words)) {
    if (/ธนาคาร/.test(line.text)) continue; // skip the bank letterhead
    const m = line.text.match(COMPANY_RE);
    if (!m) continue;
    const startI = line.words.findIndex((w) => w.text.includes("บริษัท"));
    let endI = line.words.findIndex((w) => w.text.includes("มหาชน"));
    if (endI < 0) endI = line.words.length - 1;
    const span = line.words.slice(Math.max(0, startI), endI + 1);
    if (!span.length) continue;
    const x = Math.min(...span.map((w) => w.x0));
    const y = Math.min(...span.map((w) => w.y0));
    const box = { x: x / W, y: y / H, w: (Math.max(...span.map((w) => w.x1)) - x) / W, h: (Math.max(...span.map((w) => w.y1)) - y) / H };
    return { key: "payer_name", value: span.map((w) => w.text).join(" ").replace(/\s+/g, " ").trim(), box, conf: span.reduce((s, w) => s + w.conf, 0) / span.length };
  }
  return null;
}

// Fold located boxes into a SlipFields (deriving the WHT rate from the amounts).
// Only the four keyword fields are set; the rest stay blank for the user/Typhoon.
export function slipFromBoxes(found: FieldBox[]): SlipFields {
  const by = new Map(found.map((f) => [f.key, f.value]));
  const n = (k: FieldKey) => (by.has(k) ? Number(by.get(k)) : null);
  const gross = n("gross_amount");
  const wht = n("wht_amount");
  return {
    ...EMPTY_SLIP,
    bond_symbol: by.get("bond_symbol") ?? null,
    payer_name: by.get("payer_name") ?? null,
    payer_tax_id: by.get("payer_tax_id") ?? null,
    gross_amount: gross,
    wht_amount: wht,
    net_amount: n("net_amount"),
    wht_rate: gross && wht ? Math.round((wht / gross) * 100) : null,
  };
}

// Locate all fields we track. Pass the user's holding symbols to lock the bond
// code to their portfolio when possible.
export function locateFields(res: OcrResult, holdings: string[] = []): FieldBox[] {
  const { words, width: W, height: H } = res;
  if (!W || !H) return [];
  const out: FieldBox[] = [];
  const tax = findPayerTaxId(words, W, H);
  if (tax) out.push(tax);
  const bond = findBondSymbol(words, W, H, holdings);
  if (bond) out.push(bond);
  const company = findCompany(words, W, H);
  if (company) out.push(company);
  out.push(...findAmounts(words, W, H));
  return out;
}
