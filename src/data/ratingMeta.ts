// Credit-rating buckets for the allocation "by rating" pillar view. Full agency
// ratings ("BBB+", "A-") collapse to their letter family; unrated → nonRate.

export const RATING_ORDER = ["AAA", "AA", "A", "BBB", "BB", "B", "nonRate"] as const;
export type RatingFamily = (typeof RATING_ORDER)[number];

export const RATING_META: Record<RatingFamily, { label: string; color: string }> = {
  AAA: { label: "AAA", color: "#2FA88C" },
  AA: { label: "AA", color: "#4A8AD4" },
  A: { label: "A", color: "#5FB865" },
  BBB: { label: "BBB", color: "#E0991B" },
  BB: { label: "BB", color: "#E8763A" },
  B: { label: "B", color: "#D95F3A" },
  nonRate: { label: "ไม่จัดอันดับ", color: "#9AA0A6" },
};

// Order matters: longest prefix first so "AAA" wins before "AA"/"A".
export function ratingFamily(rating: string | null | undefined): RatingFamily {
  if (!rating) return "nonRate";
  const m = rating.trim().toUpperCase().match(/^(AAA|AA|A|BBB|BB|B)/);
  return (m?.[1] as RatingFamily) ?? "nonRate";
}

export function ratingRank(family: RatingFamily): number {
  return RATING_ORDER.indexOf(family);
}
