// Coupon frequency is NOT in the SEC feed, so the derived timeline otherwise
// relies on the user picking it (and defaults to semi-annual). For the bonds
// we actively test with, hardcode the verified value so the 12-month timeline
// is right immediately — no guessing. Selecting a mapped bond prefills these.
//
// frequency = coupon payments per year (1 = yearly, 2 = semi-annual,
//             4 = quarterly, 12 = monthly).
// anchorDate = a known real coupon date (YYYY-MM-DD). Optional; only matters
//             for exact day-level output (current UI is month-level, so it is
//             unused for now but kept for when/if day precision returns).

export interface CouponOverride {
  frequency: number;
  anchorDate?: string;
}

export const COUPON_OVERRIDES: Record<string, CouponOverride> = {
  // Origin Property — issuer press confirms quarterly coupons.
  ORI288B: { frequency: 4 },
  // Britania pays quarterly; 1/2567 issue confirmed on the 12th
  // (12 ม.ค./เม.ย./ก.ค./ต.ค.), matching BRI267A's 2024-07-12 anchor.
  BRI267A: { frequency: 4 },
  // Same issuer, different series — Britania is consistently quarterly.
  BRI275A: { frequency: 4 },
  // BTS Group debentures pay semi-annually.
  BTSG28OA: { frequency: 2 },
};

export function overrideFor(symbol: string): CouponOverride | undefined {
  return COUPON_OVERRIDES[symbol];
}
