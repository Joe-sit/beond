// ── Brand ────────────────────────────────────────────────────────────────
export const TOTAL_PORTFOLIO_VALUE = 10000000;

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

const Y = "2568";

// Full year; months without a payout stay empty and are hidden by the
// "เฉพาะเดือนที่ได้รับ" filter.
export const mockTimeline: TimelineMonth[] = [
  {
    id: "jan",
    month: "มกราคม",
    year: Y,
    payouts: [
      {
        id: "jan-ori",
        issuer: "Origin Property",
        symbol: "ORI288B",
        installment: "1/8",
        payoutDate: "28 Jan 2025",
        payoutISO: "2025-01-28",
        amount: 70000,
      },
    ],
  },
  { id: "feb", month: "กุมภาพันธ์", year: Y, payouts: [] },
  {
    id: "mar",
    month: "มีนาคม",
    year: Y,
    payouts: [
      {
        id: "mar-siri",
        issuer: "Sansiri",
        symbol: "SIRI266A",
        installment: "3/6",
        payoutDate: "15 Mar 2025",
        payoutISO: "2025-03-15",
        amount: 45000,
      },
    ],
  },
  { id: "apr", month: "เมษายน", year: Y, payouts: [] },
  {
    id: "may",
    month: "พฤษภาคม",
    year: Y,
    payouts: [
      {
        id: "may-ori",
        issuer: "Origin Property",
        symbol: "ORI288B",
        installment: "2/8",
        payoutDate: "28 May 2025",
        payoutISO: "2025-05-28",
        amount: 70000,
      },
      {
        id: "may-gulf",
        issuer: "Gulf Energy",
        symbol: "GULF289A",
        installment: "1/4",
        payoutDate: "30 May 2025",
        payoutISO: "2025-05-30",
        amount: 32500,
      },
    ],
  },
  { id: "jun", month: "มิถุนายน", year: Y, payouts: [] },
  {
    id: "jul",
    month: "กรกฎาคม",
    year: Y,
    payouts: [
      {
        id: "jul-siri",
        issuer: "Sansiri",
        symbol: "SIRI266A",
        installment: "4/6",
        payoutDate: "15 Jul 2025",
        payoutISO: "2025-07-15",
        amount: 45000,
      },
    ],
  },
  { id: "aug", month: "สิงหาคม", year: Y, payouts: [] },
  {
    id: "sep",
    month: "กันยายน",
    year: Y,
    payouts: [
      {
        id: "sep-gulf",
        issuer: "Gulf Energy",
        symbol: "GULF289A",
        installment: "2/4",
        payoutDate: "30 Sep 2025",
        payoutISO: "2025-09-30",
        amount: 32500,
      },
    ],
  },
  { id: "oct", month: "ตุลาคม", year: Y, payouts: [] },
  {
    id: "nov",
    month: "พฤศจิกายน",
    year: Y,
    payouts: [
      {
        id: "nov-ori",
        issuer: "Origin Property",
        symbol: "ORI288B",
        installment: "3/8",
        payoutDate: "28 Nov 2025",
        payoutISO: "2025-11-28",
        amount: 70000,
      },
    ],
  },
  {
    id: "dec",
    month: "ธันวาคม",
    year: Y,
    payouts: [
      {
        id: "dec-siri",
        issuer: "Sansiri",
        symbol: "SIRI266A",
        installment: "5/6",
        payoutDate: "15 Dec 2025",
        payoutISO: "2025-12-15",
        amount: 45000,
      },
    ],
  },
];

// ── Right: investment allocation ─────────────────────────────────────────
export interface AllocationHolding {
  id: string;
  label: string;
  pct: number;
  value: number;
  color: string; // base hue; pillar faces derive lighter shades from it
  symbol?: string; // set in the per-bond view → legend shows the issuer logo
}

// Real-ish sector allocation; pct sums to 100 and values sum to
// TOTAL_PORTFOLIO_VALUE. The pillar chart supports at most 8 sectors.
export const MAX_ALLOCATION_SECTORS = 8;

export const allocationHoldings: AllocationHolding[] = [
  { id: "property", label: "อสังหาริมทรัพย์และก่อสร้าง", pct: 28, value: 2800000, color: "#4A5AA8" },
  { id: "energy", label: "พลังงานและสาธารณูปโภค", pct: 22, value: 2200000, color: "#5990D7" },
  { id: "finance", label: "ธนาคารและการเงิน", pct: 15, value: 1500000, color: "#2FA8AD" },
  { id: "food", label: "อาหารและเครื่องดื่ม", pct: 10, value: 1000000, color: "#5FB865" },
  { id: "logistics", label: "ขนส่งและโลจิสติกส์", pct: 9, value: 900000, color: "#E0991B" },
  { id: "tech", label: "เทคโนโลยีสารสนเทศ", pct: 7, value: 700000, color: "#E8763A" },
  { id: "retail", label: "พาณิชย์และค้าปลีก", pct: 5, value: 500000, color: "#D95F8A" },
  { id: "tourism", label: "ท่องเที่ยวและโรงแรม", pct: 4, value: 400000, color: "#9B6FD0" },
];

export const allocationUpdatedAt = "2 ธันวาคม 2568";

// ── Right: profile + tax credit ──────────────────────────────────────────
export const userProfile = {
  handle: "joeomlet_xd",
  loginVia: "ล็อคอินผ่าน LINE ID",
};

export const taxCredit = {
  year: "2569",
  amount: 70000,
};

// ── Mock confirmed 50-ทวิ documents ──────────────────────────────────────
// Offline sample so confirmation-driven UI (green buildings, check badges,
// year progress bar) has data without Supabase. Matched to mockTimeline
// payouts by symbol + payDate (within the 45-day window). Structural type only
// to avoid a circular import with usePortfolio.
export const mockTaxDocs = [
  { id: "doc-jan-ori", status: "confirmed" as const, payerName: "บมจ. ออริจิ้น พร็อพเพอร์ตี้", payerTaxId: "0-1055-59000-12-3", symbol: "ORI288B", incomeSubtype: "4A", grossAmount: 70000, whtAmount: 10500, whtRate: 15, payDate: "2025-01-28", taxYear: 2025 },
  { id: "doc-may-gulf", status: "confirmed" as const, payerName: "บมจ. กัลฟ์ เอ็นเนอร์จี", payerTaxId: "0-1055-58000-45-6", symbol: "GULF289A", incomeSubtype: "4A", grossAmount: 32500, whtAmount: 4875, whtRate: 15, payDate: "2025-05-30", taxYear: 2025 },
  { id: "doc-jul-siri", status: "confirmed" as const, payerName: "บมจ. แสนสิริ", payerTaxId: "0-1055-57000-78-9", symbol: "SIRI266A", incomeSubtype: "4A", grossAmount: 45000, whtAmount: 6750, whtRate: 15, payDate: "2025-07-15", taxYear: 2025 },
];
