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
  coupon?: {
    rate?: number | null;
    type?: string | null;
    name_th?: string | null;
    desc_th?: string | null;
  } | null;
  maturity?: {
    issue_date?: string | null;
    maturity_date?: string | null;
    term_year?: number | null;
  } | null;
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
    couponRate: r.coupon?.rate ?? null,
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

export function ensureCatalog(): void {
  if (catalog || catalogPromise) return;
  catalogPromise = fetch("/bond-catalog.json")
    .then((res) => (res.ok ? res.json() : null))
    .then((body: { items?: BondCandidate[] } | null) => {
      if (body?.items?.length) catalog = body.items.filter(isActive);
    })
    .catch(() => {
      /* no snapshot — remote search still works */
    })
    .finally(() => {
      catalogPromise = null;
    });
}

// ── Issuer suggestions (for manual entry) ──────────────────────────────────

// Leading letters of a bond symbol identify the issuer (e.g. ORI284C → ORI).
const symbolPrefix = (s: string) => (s.match(/^[A-Za-z]+/)?.[0] ?? "").toUpperCase();

// Unique issuer names from the loaded catalog, for an autocomplete datalist.
export function issuerNames(): string[] {
  if (!catalog) return [];
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
        (a.c.maturityDate ?? "9999").localeCompare(b.c.maturityDate ?? "9999"),
    )
    .map((s) => s.c);
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
      .filter(isActive);
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
