// Fetches the full SEC bond catalog and writes the active (not-yet-matured)
// bonds to public/bond-catalog.json for instant client-side search.
// Usage: npm run fetch:bonds   (needs SEC_API_KEY in .env.local)
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Key from the environment (CI) first, else parse .env.local (local dev).
function readKey() {
  if (process.env.SEC_API_KEY?.trim()) return process.env.SEC_API_KEY.trim();
  try {
    const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    return envFile.match(/^SEC_API_KEY=(.+)$/m)?.[1]?.trim();
  } catch {
    return undefined;
  }
}
const key = readKey();
if (!key) {
  console.error("SEC_API_KEY missing (set env var or .env.local)");
  process.exit(1);
}

// Parse coupon payment frequency (payments/year) from SEC coupon text.
const FREQ_PATTERNS = [
  [/ทุก\s*1\s*เดือน|รายเดือน|monthly/i, 12],
  [/ทุก\s*3\s*เดือน|รายไตรมาส|ไตรมาส|quarter/i, 4],
  [/ทุก\s*6\s*เดือน|ครึ่งปี|semi-?annual|half.?year/i, 2],
  [/ทุก\s*12\s*เดือน|ทุกปี|รายปี|annual|yearly/i, 1],
];
function parseFrequency(text) {
  if (!text) return null;
  for (const [re, f] of FREQ_PATTERNS) if (re.test(text)) return f;
  return null;
}

// company_id -> issuer name. SEC bond/features only carries the company_id
// code, so we resolve real names from bond/issuers first.
const issuerMap = new Map();
{
  let ic = null;
  for (;;) {
    const url =
      "https://api.sec.or.th/v2/bond/issuers?page_size=100" +
      (ic ? `&next_cursor=${encodeURIComponent(ic)}` : "");
    const res = await fetch(url, { headers: { "Ocp-Apim-Subscription-Key": key } });
    if (!res.ok) {
      console.error(`issuers page failed: HTTP ${res.status}`);
      break;
    }
    const body = await res.json();
    for (const r of body.items ?? []) {
      if (r.company_id) issuerMap.set(r.company_id, r.company_name_th || r.company_name_en);
    }
    ic = body.next_cursor ?? null;
    if (!ic) break;
  }
  console.log(`issuer names: ${issuerMap.size}`);
}

const today = new Date().toISOString().slice(0, 10);
const items = [];
let cursor = null;
let pages = 0;

for (;;) {
  const url =
    "https://api.sec.or.th/v2/bond/features?page_size=100" +
    (cursor ? `&next_cursor=${encodeURIComponent(cursor)}` : "");
  const res = await fetch(url, {
    headers: { "Ocp-Apim-Subscription-Key": key },
  });
  if (!res.ok) {
    console.error(`page ${pages + 1} failed: HTTP ${res.status}`);
    break;
  }
  const body = await res.json();
  pages++;
  for (const r of body.items ?? []) {
    if (!r.thaibma_symbol) continue;
    const maturity = r.maturity?.maturity_date?.slice(0, 10) ?? null;
    if (maturity && maturity < today) continue; // matured — not buyable
    const couponText = r.coupon?.desc_th ?? r.coupon?.name_th ?? r.coupon?.type ?? null;
    items.push({
      symbol: r.thaibma_symbol,
      nameTh: r.bond_name_th ?? r.bond_name_en ?? r.thaibma_symbol,
      nameEn: r.bond_name_en ?? "",
      isin: r.isin_code ?? "",
      issuer: issuerMap.get(r.company_id) ?? r.company_id ?? "-",
      couponRate: r.coupon?.rate ?? null,
      maturityDate: maturity,
      issueDate: r.maturity?.issue_date?.slice(0, 10) ?? null,
      termYears: r.maturity?.term_year ?? null,
      frequency: parseFrequency(couponText),
      source: "sec",
    });
  }
  if (pages % 20 === 0) console.log(`…page ${pages}, active so far ${items.length}`);
  cursor = body.next_cursor ?? null;
  if (!cursor) break;
}

writeFileSync(
  resolve(process.cwd(), "public/bond-catalog.json"),
  JSON.stringify({ at: Date.now(), items }),
);
console.log(`done: ${pages} pages, ${items.length} active bonds → public/bond-catalog.json`);
