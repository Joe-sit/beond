// Shared UI types + a couple of static labels. No fabricated portfolio/tax
// data lives here anymore — all figures come from Supabase (real) or show empty.

// ── Left: dividend timeline ──────────────────────────────────────────────
export interface TimelinePayout {
  id: string;
  issuer: string;
  symbol: string;
  installment: string;
  payoutDate: string;
  payoutISO?: string; // YYYY-MM-DD — for matching against tax_documents
  amount: number;
  color?: string; // sector hue, for the stacked bar chart
  completed?: boolean; // final coupon already paid — bond fully redeemed
}

export interface TimelineMonth {
  id: string;
  month: string;
  year: string;
  payouts: TimelinePayout[];
}

// ── Right: investment allocation ─────────────────────────────────────────
export interface AllocationHolding {
  id: string;
  label: string;
  pct: number;
  value: number;
  color: string; // base hue; pillar faces derive lighter shades from it
  symbol?: string; // set in the per-bond view → legend shows the issuer logo
}

// The pillar chart supports at most 8 sectors.
export const MAX_ALLOCATION_SECTORS = 8;

// ── Profile ──────────────────────────────────────────────────────────────
// Static UI label only (real identity comes from the LINE auth profile).
export const userProfile = {
  handle: "",
  loginVia: "ล็อคอินผ่าน LINE ID",
};
