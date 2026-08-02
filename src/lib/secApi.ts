import { supabase, supabaseEnabled } from "./supabase";
import { parseFrequency } from "./couponSchedule";

// A bond candidate shown in the add-bond search results, normalized from
// either the SEC Open Data API or the local bonds table (fallback).
export interface BondCandidate {
  symbol: string;
  nameTh: string;
  nameEn: string;
  isin: string;
  issuer: string;
  couponRate: number | null;
  maturityDate: string | null;
  issueDate: string | null;
  termYears: number | null;
  frequency: number | null; // coupon payments per year (parsed from coupon text)
  source: "sec" | "local" | "manual";
}

interface SecFeatureRow {
  thaibma_symbol: string | null;
  isin_code: string | null;
  bond_name_th: string | null;
  bond_name_en: string | null;
  company_id: string | null;
  bond_type?: string | null;
  esg_bond_type?: string | null;
  subordinated_type?: string | null;
  coupon?: {
    rate?: number | string | null;
    type?: string | null;
    name_th?: string | null;
    name_en?: string | null;
    desc_th?: string | null;
  } | null;
  maturity?: {
    issue_date?: string | null;
    maturity_date?: string | null;
    term_year?: number | null;
    term_month?: number | null;
    term_day?: number | null;
  } | null;
  offering?: {
    target?: string | null;
    currency?: string | null;
    unit?: number | null;
    value?: number | null;
    face_value?: number | null;
  } | null;
  selling?: { begin_date?: string | null; close_date?: string | null } | null;
  redemption?: { name_th?: string | null; name_en?: string | null } | null;
  embedded_option_info?: { name_th?: string | null; name_en?: string | null } | null;
  secured_info?: { name_th?: string | null; name_en?: string | null; desc_th?: string | null } | null;
  security_type?: { name_th?: string | null; name_en?: string | null } | null;
  offer_type?: { name_th?: string | null; abbr_th?: string | null; abbr_en?: string | null } | null;
  currency_info?: { name_th?: string | null } | null;
}

// Full, human-readable detail for one bond — normalized from a raw SEC feature
// row. Strings are passed through from the API's own name_th labels; numeric
// coupon rate is parsed leniently (the API sometimes returns descriptive text).
export interface BondDetail extends BondCandidate {
  bondType: string | null;
  esgType: string | null;
  subordinated: string | null;
  secured: string | null;
  securedDesc: string | null;
  securityType: string | null;
  offerType: string | null; // e.g. "เสนอขายต่อประชาชนทั่วไป (PO)"
  offerAbbr: string | null; // PO / PP / II / II/HNW / IH
  redemption: string | null;
  embeddedOption: string | null;
  currency: string | null;
  unit: number | null; // minimum trading unit (baht)
  offerValue: number | null; // total issue size
  faceValue: number | null;
  sellingBegin: string | null;
  sellingClose: string | null;
  termMonth: number | null;
  termDay: number | null;
  couponName: string | null; // "อัตราดอกเบี้ยคงที่"
  couponDesc: string | null;
  couponRateText: string | null; // raw rate text when not a clean number
}

// Parse the leading numeric percentage out of the coupon.rate field, which can
// be a number, "5.8", or descriptive Thai text ("ร้อยละ 4.875 ต่อปี …").
function parseCouponRate(rate: number | string | null | undefined): number | null {
  if (rate == null) return null;
  if (typeof rate === "number") return Number.isFinite(rate) ? rate : null;
  const m = rate.replace(/,/g, "").match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function toDetail(r: SecFeatureRow): BondDetail {
  const base = toCandidate(r);
  return {
    ...base,
    couponRate: parseCouponRate(r.coupon?.rate),
    bondType: r.bond_type ?? null,
    esgType: r.esg_bond_type ?? null,
    subordinated: r.subordinated_type ?? null,
    secured: r.secured_info?.name_th ?? null,
    securedDesc: r.secured_info?.desc_th ?? null,
    securityType: r.security_type?.name_th ?? null,
    offerType: r.offer_type?.name_th ?? null,
    offerAbbr: r.offer_type?.abbr_en ?? r.offer_type?.abbr_th ?? null,
    redemption: r.redemption?.name_th ?? null,
    embeddedOption: r.embedded_option_info?.name_th ?? null,
    currency: r.currency_info?.name_th ?? r.offering?.currency ?? null,
    unit: r.offering?.unit ?? null,
    offerValue: r.offering?.value ?? null,
    faceValue: r.offering?.face_value ?? null,
    sellingBegin: r.selling?.begin_date?.slice(0, 10) ?? null,
    sellingClose: r.selling?.close_date?.slice(0, 10) ?? null,
    termMonth: r.maturity?.term_month ?? null,
    termDay: r.maturity?.term_day ?? null,
    couponName: r.coupon?.name_th ?? null,
    couponDesc: r.coupon?.desc_th ?? null,
    couponRateText: typeof r.coupon?.rate === "string" ? r.coupon.rate : null,
  };
}

// Fetch the full detail for one bond by symbol, on demand (bond-detail view).
// Uses the SEC proxy; returns null if the row can't be found or the network
// fails (caller falls back to the slim catalog candidate). Dev-only until a
// production edge proxy exists.
const detailCache = new Map<string, BondDetail | null>();
export async function fetchBondDetail(
  symbol: string,
  signal?: AbortSignal,
): Promise<BondDetail | null> {
  const sym = symbol.trim().toUpperCase();
  if (!sym) return null;
  if (detailCache.has(sym)) return detailCache.get(sym)!;
  try {
    const res = await fetch(
      `/sec-api/v2/bond/features?search_term=${encodeURIComponent(sym)}&page_size=20`,
      { signal },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as SecFeatureResponse;
    const row = (body.items ?? []).find((r) => r.thaibma_symbol?.toUpperCase() === sym);
    const detail = row ? toDetail(row) : null;
    detailCache.set(sym, detail);
    return detail;
  } catch {
    return null;
  }
}

interface SecFeatureResponse {
  items?: SecFeatureRow[];
  next_cursor?: string | null;
}

function toCandidate(r: SecFeatureRow): BondCandidate {
  const couponText = r.coupon?.desc_th ?? r.coupon?.name_th ?? r.coupon?.type ?? null;
  return {
    symbol: r.thaibma_symbol!,
    nameTh: r.bond_name_th ?? r.bond_name_en ?? r.thaibma_symbol!,
    nameEn: r.bond_name_en ?? "",
    isin: r.isin_code ?? "",
    issuer: r.company_id ?? "-",
    couponRate: parseCouponRate(r.coupon?.rate),
    maturityDate: r.maturity?.maturity_date?.slice(0, 10) ?? null,
    issueDate: r.maturity?.issue_date?.slice(0, 10) ?? null,
    termYears: r.maturity?.term_year ?? null,
    frequency: parseFrequency(couponText),
    source: "sec",
  };
}

function isActive(c: BondCandidate): boolean {
  // Hide bonds that already matured — users can't buy those.
  return !c.maturityDate || c.maturityDate >= new Date().toISOString().slice(0, 10);
}

// ── Catalog ──────────────────────────────────────────────────────────────
// The SEC search_term only matches symbol / ISIN / company_id, so free-text
// searches ("origin", "ปตท") miss. A build-time script
// (scripts/fetch-bond-catalog.mjs) snapshots all ACTIVE bonds into
// public/bond-catalog.json; we load it once and fuzzy-search locally.

let catalog: BondCandidate[] | null = null;
let catalogPromise: Promise<void> | null = null;
let catalogAt: number | null = null; // snapshot timestamp (from the JSON `at` field)

// Epoch ms of the loaded catalog snapshot, or null before it loads.
export function catalogUpdatedAt(): number | null {
  return catalogAt;
}

// Admin-uploaded snapshot in Supabase Storage (refreshed from the dashboard);
// falls back to the build-time bundle. Loading the Storage copy first means an
// admin import goes live without a redeploy.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const CATALOG_SOURCES = [
  SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/catalog/bond-catalog.json` : null,
  "/bond-catalog.json",
].filter((u): u is string => !!u);

export function ensureCatalog(): void {
  if (catalog || catalogPromise) return;
  catalogPromise = (async () => {
    for (const src of CATALOG_SOURCES) {
      try {
        const res = await fetch(src, { cache: "no-cache" });
        if (!res.ok) continue;
        const body = (await res.json()) as { items?: BondCandidate[]; at?: number } | null;
        if (body?.items?.length) {
          // Older snapshots stored coupon.rate verbatim, which for floating-rate
          // bonds is a long descriptive string. Coerce to a clean number (or
          // null) so the UI never renders a paragraph in a "5.8%" slot.
          catalog = body.items.filter(isActive).map((c) => ({
            ...c,
            couponRate: parseCouponRate(c.couponRate as number | string | null),
          }));
          catalogAt = body.at ?? null;
          return;
        }
      } catch {
        /* try the next source */
      }
    }
  })().finally(() => {
    catalogPromise = null;
  });
}

// ── Issuer suggestions (for manual entry) ──────────────────────────────────

// Leading letters of a bond symbol identify the issuer (e.g. ORI284C → ORI).
const symbolPrefix = (s: string) => (s.match(/^[A-Za-z]+/)?.[0] ?? "").toUpperCase();

// Unique issuer names from the loaded catalog, for an autocomplete datalist.
// The authoritative full issuer name for a symbol, from the SEC catalog. Lets
// display self-heal stale/short issuer strings saved on older bond rows.
export function catalogIssuer(symbol: string): string | null {
  if (!catalog || !symbol) return null;
  const s = symbol.toUpperCase();
  return catalog.find((c) => c.symbol.toUpperCase() === s)?.issuer ?? null;
}

export function issuerNames(): string[] {
  if (!catalog) return [];
  // Full registered names verbatim — same string issuerName() shows elsewhere,
  // so the dropdown options match search / list / summary exactly.
  return [...new Set(catalog.map((c) => c.issuer).filter((x) => x && x !== "-"))].sort();
}

// Best-guess issuer for a typed symbol, by matching its letter prefix against
// the catalog (e.g. ORI284C → issuer of other ORI* bonds). Null if unknown.
export function issuerForSymbol(symbol: string): string | null {
  if (!catalog) return null;
  const p = symbolPrefix(symbol);
  if (p.length < 2) return null;
  return catalog.find((c) => symbolPrefix(c.symbol) === p)?.issuer ?? null;
}

// A representative bond symbol for an issuer name — lets callers resolve
// issuer-derived data (e.g. the credit rating) when only the company is known.
export function symbolForIssuer(issuer: string): string | null {
  if (!catalog || !issuer) return null;
  return catalog.find((c) => c.issuer === issuer)?.symbol ?? null;
}

// ── Search ───────────────────────────────────────────────────────────────

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

// Every token in the query must match somewhere (symbol, name, or ISIN) —
// so adding more keywords narrows the list instead of being ignored.
function searchCatalog(term: string): BondCandidate[] {
  if (!catalog) return [];
  const tokens = term.toLowerCase().split(/\s+/).filter(Boolean).map(norm);
  if (!tokens.length) return [];

  const scored: { c: BondCandidate; score: number }[] = [];
  for (const c of catalog) {
    const sym = norm(c.symbol);
    const nameEn = norm(c.nameEn);
    const nameTh = norm(c.nameTh);
    const isin = norm(c.isin);
    let total = 0;
    let miss = false;
    for (const t of tokens) {
      let s = -1;
      if (sym.startsWith(t)) s = 0;
      else if (sym.includes(t)) s = 1;
      else if (nameEn.includes(t) || nameTh.includes(t)) s = 2;
      else if (isin.includes(t)) s = 3;
      if (s < 0) {
        miss = true;
        break;
      }
      total += s;
    }
    if (!miss) scored.push({ c, score: total });
  }
  return scored
    .sort(
      (a, b) =>
        a.score - b.score ||
        // Newest issued first (issueDate desc) within the same relevance tier.
        (b.c.issueDate ?? "").localeCompare(a.c.issueDate ?? ""),
    )
    .map((s) => s.c);
}

// Instant, catalog-only search — no network. Lets the UI decide results /
// empty-state immediately; the remote search backfills in the background.
export function searchLocal(term: string): BondCandidate[] {
  const q = term.trim();
  if (q.length < 2) return [];
  return searchCatalog(q).slice(0, 30);
}

// The SEC search_term endpoint returns loose prefix/fuzzy matches (searching
// "ORI284C" also yields ORI284B, ORI288A…). Keep only candidates that actually
// contain every query token — same relevance bar as the local catalog — so we
// never show a bond the user didn't search for.
function matchesAllTokens(c: BondCandidate, term: string): boolean {
  const tokens = term.toLowerCase().split(/\s+/).filter(Boolean).map(norm);
  if (!tokens.length) return false;
  const sym = norm(c.symbol);
  const nameEn = norm(c.nameEn);
  const nameTh = norm(c.nameTh);
  const isin = norm(c.isin);
  return tokens.every(
    (t) => sym.includes(t) || nameEn.includes(t) || nameTh.includes(t) || isin.includes(t),
  );
}

const remoteCache = new Map<string, BondCandidate[]>();

async function searchRemote(
  term: string,
  signal?: AbortSignal,
): Promise<BondCandidate[]> {
  const cached = remoteCache.get(term);
  if (cached) return cached;
  try {
    const res = await fetch(
      `/sec-api/v2/bond/features?search_term=${encodeURIComponent(term)}&page_size=20`,
      { signal },
    );
    if (!res.ok) return [];
    const body = (await res.json()) as SecFeatureResponse;
    const items = (body.items ?? [])
      .filter((r) => r.thaibma_symbol)
      .map(toCandidate)
      .filter(isActive)
      .filter((c) => matchesAllTokens(c, term)); // drop SEC's fuzzy non-matches
    remoteCache.set(term, items);
    return items;
  } catch {
    return [];
  }
}

async function searchSupabase(term: string): Promise<BondCandidate[]> {
  if (!supabaseEnabled || !supabase) return [];
  const { data } = await supabase
    .from("bonds")
    .select("symbol, issuer, coupon_rate, maturity_date")
    .or(`symbol.ilike.%${term}%,issuer.ilike.%${term}%`)
    .limit(20);
  return (data ?? []).map((b) => ({
    symbol: b.symbol,
    nameTh: `หุ้นกู้ ${b.issuer}`,
    nameEn: b.issuer,
    isin: "",
    issuer: b.issuer,
    couponRate: Number(b.coupon_rate),
    maturityDate: b.maturity_date,
    issueDate: null,
    termYears: null,
    frequency: null,
    source: "local" as const,
  }));
}

// Local catalog answers instantly; the remote search backfills anything the
// (possibly still-loading) catalog doesn't have yet. Results deduped by symbol.
export async function searchBonds(
  term: string,
  signal?: AbortSignal,
): Promise<BondCandidate[]> {
  const q = term.trim();
  if (q.length < 2) return [];

  const local = searchCatalog(q);
  if (local.length >= 8) return local.slice(0, 30);

  const [remote, own] = await Promise.all([
    searchRemote(q, signal),
    local.length ? Promise.resolve([]) : searchSupabase(q),
  ]);

  const seen = new Set<string>();
  const merged: BondCandidate[] = [];
  for (const c of [...local, ...remote, ...own]) {
    if (seen.has(c.symbol)) continue;
    seen.add(c.symbol);
    merged.push(c);
  }
  return merged.slice(0, 30);
}
