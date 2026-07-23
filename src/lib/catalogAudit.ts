import { supabase, supabaseEnabled } from "./supabase";

// A bond that users hold / added but is missing from the local catalog snapshot
// (public/bond-catalog.json) — i.e. it needs adding to the catalog. Usually a
// manual entry (a PO too new for the SEC feed) or a bond added while the
// snapshot was stale.
export interface UncataloguedBond {
  symbol: string;
  issuer: string;
  maturityDate: string | null;
  holders: number; // how many holdings reference it
}

export type CatalogAuditResult =
  | { kind: "ok"; bonds: UncataloguedBond[]; catalogSize: number }
  | { kind: "unavailable" };

interface BondRow {
  id: string;
  symbol: string;
  issuer: string;
  maturity_date: string | null;
}

// Diff the bonds table against the catalog snapshot; return DB bonds whose
// symbol isn't in the snapshot, with a holder count so the admin can prioritise.
export async function fetchUncataloguedBonds(): Promise<CatalogAuditResult> {
  if (!supabaseEnabled || !supabase) return { kind: "unavailable" };

  // Catalog snapshot symbols.
  let catalogSymbols = new Set<string>();
  let catalogSize = 0;
  try {
    const res = await fetch("/bond-catalog.json");
    if (res.ok) {
      const body = (await res.json()) as { items?: { symbol: string }[] };
      catalogSymbols = new Set((body.items ?? []).map((i) => i.symbol));
      catalogSize = catalogSymbols.size;
    }
  } catch {
    /* no snapshot — every DB bond will look uncatalogued */
  }

  const { data: bonds, error } = await supabase
    .from("bonds")
    .select("id, symbol, issuer, maturity_date");
  if (error || !bonds) return { kind: "unavailable" };

  const missing = (bonds as BondRow[]).filter((b) => !catalogSymbols.has(b.symbol));
  if (missing.length === 0) return { kind: "ok", bonds: [], catalogSize };

  // Holder counts per uncatalogued bond.
  const ids = missing.map((b) => b.id);
  const { data: holdings } = await supabase
    .from("holdings")
    .select("bond_id")
    .in("bond_id", ids);
  const counts = new Map<string, number>();
  for (const h of (holdings ?? []) as { bond_id: string }[]) {
    counts.set(h.bond_id, (counts.get(h.bond_id) ?? 0) + 1);
  }

  const list = missing
    .map((b) => ({
      symbol: b.symbol,
      issuer: b.issuer,
      maturityDate: b.maturity_date,
      holders: counts.get(b.id) ?? 0,
    }))
    .sort((a, b) => b.holders - a.holders || a.symbol.localeCompare(b.symbol));

  return { kind: "ok", bonds: list, catalogSize };
}
