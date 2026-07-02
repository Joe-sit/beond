// ── Brand ────────────────────────────────────────────────────────────────
export const TOTAL_PORTFOLIO_VALUE = 10000000;

// ── Left: dividend timeline ──────────────────────────────────────────────
export interface TimelineEntry {
  id: string;
  month: string;
  year: string;
  total: string;
  issuer: string;
  symbol: string;
  installment: string;
  payoutDate: string;
  amount: number;
}

// Each entry = one month with a single payout card (matches design).
export const mockTimeline: TimelineEntry[] = [
  {
    id: "jan-1",
    month: "มกราคม",
    year: "2568",
    total: "15k",
    issuer: "Origin Property",
    symbol: "ORI288B",
    installment: "2/8",
    payoutDate: "28 May 2026",
    amount: 70000,
  },
  {
    id: "jan-2",
    month: "มกราคม",
    year: "2568",
    total: "15k",
    issuer: "Origin Property",
    symbol: "ORI288B",
    installment: "2/8",
    payoutDate: "28 May 2026",
    amount: 70000,
  },
  {
    id: "jan-3",
    month: "มกราคม",
    year: "2568",
    total: "15k",
    issuer: "Origin Property",
    symbol: "ORI288B",
    installment: "2/8",
    payoutDate: "28 May 2026",
    amount: 70000,
  },
];

// ── Right: investment allocation ─────────────────────────────────────────
export interface AllocationHolding {
  id: string;
  label: string;
  pct: number;
  value: number;
}

export const allocationHoldings: AllocationHolding[] = Array.from(
  { length: 6 },
  (_, i) => ({
    id: `alloc-${i}`,
    label: "อสังหาริมทรัพย์และก่อสร้าง",
    pct: 50,
    value: 5000000,
  }),
);

export const allocationUpdatedAt = "2 ธันวาคม 2568";

// 3D staircase steps (ascending), rendered as an isometric chart.
export interface AllocationStep {
  pct: number;
}

export const allocationSteps: AllocationStep[] = [
  { pct: 30 },
  { pct: 70 },
  { pct: 90 },
  { pct: 50 },
];

// ── Right: profile + tax credit ──────────────────────────────────────────
export const userProfile = {
  handle: "joeomlet_xd",
  loginVia: "ล็อคอินผ่าน LINE ID",
};

export const taxCredit = {
  year: "2569",
  amount: 70000,
};
