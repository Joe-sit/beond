// Model A: 12-Month Cash Flow Timeline Schema
export const mockTimelineData = [
  {
    month: "มกราคม 2568",
    isPayout: true,
    totalAmount: 15500,
    payouts: [
      { issuer: "Origin Property", symbol: "ORI288B", rate: "5.6%", payoutDate: "28 May 2026", amount: 70000 },
    ],
  },
  {
    month: "กุมภาพันธ์ 2568",
    isPayout: true,
    totalAmount: 15500,
    payouts: [
      { issuer: "Origin Property", symbol: "ORI288B", rate: "5.6%", payoutDate: "28 May 2026", amount: 70000 },
    ],
  },
  { month: "มีนาคม 2568", isPayout: false, payouts: [] },
  { month: "เมษายน 2568", isPayout: false, payouts: [] },
  { month: "พฤษภาคม 2568", isPayout: false, payouts: [] },
  { month: "มิถุนายน 2568", isPayout: false, payouts: [] },
  {
    month: "กรกฎาคม 2568",
    isPayout: true,
    isClustered: false,
    totalAmount: 51000,
    payouts: [
      { issuer: "SANSIRI (SIRI)", amount: 18500, etaText: "ใน 2 สัปดาห์", color: "blue-900" },
      { issuer: "CPALL (CPALL)", amount: 32500, etaText: "ใน 2 สัปดาห์", color: "orange-500" },
    ],
  },
  { month: "สิงหาคม 2568", isPayout: false, payouts: [] },
  { month: "กันยายน 2568", isPayout: false, payouts: [] },
  {
    month: "ตุลาคม 2568",
    isPayout: true,
    isClustered: true,
    totalAmount: 75000,
    issuers: ["TRUE", "BGRIM", "SC"],
  },
  { month: "พฤศจิกายน 2568", isPayout: false, payouts: [] },
  { month: "ธันวาคม 2568", isPayout: false, payouts: [] },
];

// Model B: Core Asset Ledger Schema — 12 holdings, principal sums to ฿10,000,000
export const mockPortfolioData = [
  { symbol: "CPALL266A", company: "CPALL", rating: "A+", couponRate: 5.6, principal: 900000, nextDate: "1 ต.ค. 2568", sector: "Retail" },
  { symbol: "SC25OA", company: "SC", rating: "A-", couponRate: 4.5, principal: 700000, nextDate: "1 ก.ค. 2568", sector: "Property" },
  { symbol: "BGRIM29OA", company: "BGRIM", rating: "A", couponRate: 5.6, principal: 950000, nextDate: "1 ต.ค. 2568", sector: "Power" },
  { symbol: "TRUE266A", company: "TRUE", rating: "A+", couponRate: 4.6, principal: 850000, nextDate: "1 ต.ค. 2568", sector: "Telecom" },
  { symbol: "ORI288B", company: "Origin Property", rating: "BBB+", couponRate: 5.6, principal: 700000, nextDate: "28 พ.ค. 2569", sector: "Property" },
  { symbol: "SIRI289A", company: "SANSIRI", rating: "BBB+", couponRate: 5.2, principal: 800000, nextDate: "15 ก.ค. 2568", sector: "Property" },
  { symbol: "AOT286A", company: "AOT", rating: "AAA", couponRate: 3.2, principal: 900000, nextDate: "1 ก.ย. 2568", sector: "Transport" },
  { symbol: "BBL29NA", company: "BBL", rating: "AAA", couponRate: 3.0, principal: 1000000, nextDate: "1 ธ.ค. 2568", sector: "Banking" },
  { symbol: "PTTGC27OA", company: "PTTGC", rating: "AA-", couponRate: 4.0, principal: 750000, nextDate: "1 พ.ย. 2568", sector: "Energy" },
  { symbol: "CPF268A", company: "CPF", rating: "A", couponRate: 4.8, principal: 700000, nextDate: "1 ส.ค. 2568", sector: "Food" },
  { symbol: "BTS276A", company: "BTS", rating: "A-", couponRate: 4.2, principal: 650000, nextDate: "1 มิ.ย. 2568", sector: "Transport" },
  { symbol: "KBANK29FA", company: "KBANK", rating: "AAA", couponRate: 3.5, principal: 1100000, nextDate: "1 ก.พ. 2569", sector: "Banking" },
];

export const sectorMeta = {
  Property: { icon: "🏠", color: "#f2b84b" },
  Banking: { icon: "🏦", color: "#94a3b8" },
  Transport: { icon: "🚌", color: "#f2994a" },
  Power: { icon: "⚡", color: "#fde68a" },
  Retail: { icon: "🛒", color: "#1e3a5f" },
  Telecom: { icon: "📡", color: "#7dd3c0" },
  Energy: { icon: "🛢️", color: "#c2410c" },
  Food: { icon: "🍽️", color: "#a78bfa" },
};

export const TOTAL_PORTFOLIO_VALUE = 10000000;
export const TOTAL_ASSET_COUNT = 12;
