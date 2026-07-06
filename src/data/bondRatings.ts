import { TRIS_RATINGS } from "./trisRatings";

// Credit rating for a bond, sourced from the TRIS Rating issuer list
// ([[trisRatings]]). A ThaiBMA bond symbol starts with its issuer abbreviation
// (ORI288B → ORI, SIRI266A → SIRI), which is exactly how TRIS keys issuers — so
// we match on the symbol's alphabetic prefix, shortening it until it hits a
// rated issuer (e.g. BTSG28OA → BTSG → BTS). Returns null when unrated by TRIS
// (foreign-rated names like KBANK, or Withdrawn/NR) → treated as "nonRate".
//
// SEC's bond feed carries no rating, so this is the rating source. Refresh by
// regenerating trisRatings.ts from a new TRIS export.

const MIN_PREFIX = 3;

export function ratingFor(symbol: string): string | null {
  const prefix = symbol.match(/^[A-Za-z]+/)?.[0]?.toUpperCase();
  if (!prefix) return null;
  for (let len = prefix.length; len >= MIN_PREFIX; len--) {
    const hit = TRIS_RATINGS[prefix.slice(0, len)];
    if (hit) return hit;
  }
  return null;
}
