import { useSyncExternalStore } from "react";

// Tiny app-wide language store (no provider needed). Any component reads the
// live language with useLang()/useT(); the sidebar switch calls setLang() and
// every subscriber re-renders. Persisted so the choice survives reloads.
export type Lang = "th" | "en";
const KEY = "beond:lang";

let current: Lang = ((): Lang => {
  const v = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
  return v === "en" || v === "th" ? v : "th";
})();

const subs = new Set<() => void>();

export function setLang(l: Lang) {
  if (l === current) return;
  current = l;
  try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  subs.forEach((f) => f());
}

function subscribe(f: () => void) {
  subs.add(f);
  return () => subs.delete(f);
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, () => current, () => current);
}

// ── Dictionary ───────────────────────────────────────────────────────────────
// Values may contain {name} placeholders filled by t(key, vars).
type Dict = Record<string, string>;

const TH: Dict = {
  tagline: "Bring Your Bonds Beyond",
  nav_home: "หน้าหลัก",
  nav_annual: "สรุปประจำปี",
  nav_download_ext: "ดาวน์โหลดส่วนขยาย",
  nav_settings: "ตั้งค่า",
  nav_tax_base: "ฐานภาษี",

  portfolio_title: "พอร์ตโฟลิโอของฉัน",
  hide_value: "ซ่อนมูลค่า",
  show_value: "แสดงมูลค่า",
  avg_coupon: "ดอกเบี้ยเฉลี่ย",
  avg_remaining: "อายุคงเหลือเฉลี่ย",
  year_unit: "ปี",

  holdings_title: "หุ้นกู้ที่ถืออยู่",
  holdings_unit: "รุ่น",
  interest_per_month: "ดอกเบี้ยต่อเดือน",
  add_bond: "เพิ่มหุ้นกู้",
  invest_value: "มูลค่าลงทุน",
  no_holdings: "ยังไม่มีหุ้นกู้ในพอร์ต",

  view_month: "รายเดือน",
  view_quarter: "รายไตรมาส",
  close_view: "ปิดมุมมอง",

  slips_to_collect: "สลิปที่ต้องสะสมของเดือน",
  slip_unit: "ใบ",
  collected_all_year: "สะสมได้ตลอดปี",

  prev_month: "เดือนก่อน",
  next_month: "เดือนถัดไป",
  restore_current: "กลับสู่เดือนปัจจุบัน",
  back: "ย้อนกลับ",

  interest_of_month: "ดอกเบี้ยเดือน",
  list: "รายชื่อ",
  installment: "งวดที่",
  confirmed: "ยืนยันแล้ว",
  pending: "รอการยืนยัน",
  wht: "หัก ณ ที่จ่าย",
  refundable: "ขอคืนได้ (ฐาน {rate})",
  acknowledge: "รับทราบ",

  story_interest_year: "ดอกเบี้ยเข้าปี {year} · {n} เดือน",
  story_collect_total: "เก็บสลิปทุกเดือน รวม ฿{amount}",
  story_collect_full: "สะสมให้ครบ เพื่อขอคืนภาษีปลายปี",
  slip_filed: "เก็บสลิปเข้าแฟ้มแล้ว",
  token_minted: "แปลงเป็นโทเคนสะสม",
  skip_intro: "ข้ามอินโทร",
  goal_year_title: "เป้าหมายภาษีปี {year}",
  goal_collect_all: "สะสมสลิป 50 ทวิให้ครบ",
  goal_max_refund: "ขอคืนได้สูงสุด",
  tax_base_rate: "ฐานภาษี {rate}%",
  tax_base_label: "ตั้งค่าฐานภาษี",
  tax_base_title: "เลือกฐานภาษีที่คุณเสียอยู่ในปีนี้",
  tax_base_desc: "ผลประโยชน์การขอเครดิตภาษีคืนเหมาะสำหรับผู้ที่มีฐานภาษีไม่เกิน 15% ถึงสามารถยื่นขอการชำระภาษีส่วนเกินได้ หากท่านเป็นผู้มีฐานภาษีสูงกว่า 15% แนะนำให้เสียภาษี ณ ที่จ่ายเป็น Final Tax",
  tax_base_saved: "บันทึกฐานภาษีแล้ว",
  tax_overpaid_title: "ภาษีที่ชำระไว้เกินปีนี้",
  tax_overpaid_sub: "ที่คุณจะขอคืนได้",
  tax_wht_total: "ภาษีหัก ณ ที่จ่ายทั้งปี",
  tax_claimable: "ขอคืนได้ (ตามฐานภาษี)",

  scan_via_line: "สแกนสลิปผ่าน LINE",
  add_line_friend: "แอดเพื่อนเลย @beond",

  user: "ผู้ใช้",
  profile: "โปรไฟล์",
  beond_account: "บัญชี beond",
  logout: "ออกจากระบบ",

  toast_removed: "ลบ {symbol} ออกจากพอร์ตแล้ว",
  toast_remove_failed: "ลบไม่สำเร็จ",

  // Add-bond flow
  freq_annual: "ปีละครั้ง",
  freq_semi: "ทุก 6 เดือน",
  freq_quarter: "ทุก 3 เดือน",
  freq_monthly: "ทุกเดือน",
  issue_date: "วันที่ออก",
  open_calendar: "เปิดปฏิทิน",
  edit: "แก้ไข",
  search: "ค้นหา",
  confirm: "ยืนยัน",
  manual_entry: "กรอกเอง",
  saving: "กำลังบันทึก...",
  save: "บันทึก",
  review_before_save: "ตรวจสอบข้อมูลก่อนบันทึก",
  term: "อายุหุ้นกู้",
  company_name: "ชื่อบริษัท",
  coupon_label: "ดอกเบี้ย (% ต่อปี)",
  invested_baht: "มูลค่าที่ลงทุน (บาท)",
  pays_interest: "จ่ายดอกเบี้ย",
  term_years: "อายุหุ้นกู้ (ปี)",
  term_months: "อายุหุ้นกู้ (เดือน)",
  month_unit: "เดือน",
  search_bond: "ค้นหาหุ้นกู้",
  search_hint: "พิมพ์รหัสหุ้นกู้ / ชื่อบริษัท เช่น ORI288B, SIRI266A, BTSG28OA",
  no_match: "ไม่พบหุ้นกู้ที่ตรงกับ",
  add_to_portfolio: "เพิ่มเข้าพอร์ต",
  investment_baht: "จำนวนเงินลงทุน (บาท)",
  eg_symbol: "เช่น ORI288B",
  eg_company: "เช่น ออริจิ้น พร็อพเพอร์ตี้",
  eg_coupon: "เช่น 5.5",
  eg_amount: "เช่น 100,000",

  err_enter_symbol: "กรอกชื่อรุ่นหุ้นกู้",
  err_enter_symbol_company: "กรอกชื่อรุ่นและชื่อบริษัท",
  err_enter_coupon_amount: "กรอกดอกเบี้ยและมูลค่าที่ลงทุน",
  err_enter_date_term: "กรอกวันที่ออกและอายุหุ้นกู้",
  err_no_user: "ไม่พบผู้ใช้ กรุณาเข้าสู่ระบบใหม่",
  err_save_failed: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง",
  toast_updated: "อัปเดต {symbol} แล้ว",
  toast_added: "เพิ่ม {symbol} เข้าพอร์ตแล้ว",

  sec_source: "ข้อมูลตราสารหนี้จาก SEC Open Data API (ก.ล.ต.)",
  manual_hint: "สำหรับหุ้นกู้ที่ยังไม่มีในระบบ SEC",
  bond_info: "ข้อมูลหุ้นกู้",
  symbol_field: "ชื่อรุ่น",
  yield_section: "ผลตอบแทน",
  coupon_word: "ดอกเบี้ย",
  per_year: "ต่อปี",
  maturity: "ครบกำหนด",
  review: "ตรวจสอบ",
  invested_amount: "มูลค่าที่ลงทุน",
  no_credit_info: "ไม่มีข้อมูลเครดิต",
  add_own: 'เพิ่ม "{term}" เอง',
  toast_updated_amount: "อัปเดต {symbol} เป็น ฿{amount} แล้ว",
  toast_removed_generic: "ลบหุ้นกู้แล้ว",
  err_save_failed_short: "บันทึกไม่สำเร็จ",
};

const EN: Dict = {
  tagline: "Bring Your Bonds Beyond",
  nav_home: "Home",
  nav_annual: "Annual Summary",
  nav_download_ext: "Download Extension",
  nav_settings: "Settings",
  nav_tax_base: "Tax bracket",

  portfolio_title: "My Portfolio",
  hide_value: "Hide value",
  show_value: "Show value",
  avg_coupon: "Avg. coupon",
  avg_remaining: "Avg. remaining",
  year_unit: "yr",

  holdings_title: "Your Holdings",
  holdings_unit: "bonds",
  interest_per_month: "Interest / month",
  add_bond: "Add Bond",
  invest_value: "Invested",
  no_holdings: "No bonds in your portfolio yet",

  view_month: "Monthly",
  view_quarter: "Quarterly",
  close_view: "Close view",

  slips_to_collect: "Slips to collect this month",
  slip_unit: "slips",
  collected_all_year: "Collected this year",

  prev_month: "Previous month",
  next_month: "Next month",
  restore_current: "Back to current month",
  back: "Back",

  interest_of_month: "Interest for",
  list: "List",
  installment: "Installment",
  confirmed: "Confirmed",
  pending: "Pending",
  wht: "Withholding tax",
  refundable: "Refundable (rate {rate})",
  acknowledge: "Got it",

  story_interest_year: "Interest in {year} · {n} months",
  story_collect_total: "Collect every month, total ฿{amount}",
  story_collect_full: "Collect them all to claim your year-end refund",
  slip_filed: "Slip filed away",
  token_minted: "Minted as a token",
  skip_intro: "Skip intro",
  goal_year_title: "{year} tax goal",
  goal_collect_all: "Collect all your Form 50 Bis slips",
  goal_max_refund: "Refund up to",
  tax_base_rate: "Tax bracket {rate}%",
  tax_base_label: "Tax bracket settings",
  tax_base_title: "Select the tax bracket you pay this year",
  tax_base_desc: "Claiming a tax-credit refund suits those in a bracket of 15% or below — only then can you file for the over-withheld amount. If your bracket is above 15%, we recommend keeping the withholding as a Final Tax.",
  tax_base_saved: "Tax bracket saved",
  tax_overpaid_title: "Overpaid tax this year",
  tax_overpaid_sub: "that you can claim back",
  tax_wht_total: "Total tax withheld this year",
  tax_claimable: "Claimable back (by bracket)",

  scan_via_line: "Scan slip via LINE",
  add_line_friend: "Add @beond as a friend",

  user: "User",
  profile: "Profile",
  beond_account: "beond account",
  logout: "Log out",

  toast_removed: "Removed {symbol} from your portfolio",
  toast_remove_failed: "Remove failed",

  // Add-bond flow
  freq_annual: "Annually",
  freq_semi: "Every 6 months",
  freq_quarter: "Every 3 months",
  freq_monthly: "Monthly",
  issue_date: "Issue date",
  open_calendar: "Open calendar",
  edit: "Edit",
  search: "Search",
  confirm: "Confirm",
  manual_entry: "Manual entry",
  saving: "Saving...",
  save: "Save",
  review_before_save: "Review before saving",
  term: "Term",
  company_name: "Company name",
  coupon_label: "Coupon (% p.a.)",
  invested_baht: "Invested amount (THB)",
  pays_interest: "Pays interest",
  term_years: "Term (years)",
  term_months: "Term (months)",
  month_unit: "mo",
  search_bond: "Search bonds",
  search_hint: "Type a bond symbol / company, e.g. ORI288B, SIRI266A, BTSG28OA",
  no_match: "No bonds match",
  add_to_portfolio: "Add to portfolio",
  investment_baht: "Investment amount (THB)",
  eg_symbol: "e.g. ORI288B",
  eg_company: "e.g. Origin Property",
  eg_coupon: "e.g. 5.5",
  eg_amount: "e.g. 100,000",

  err_enter_symbol: "Enter the bond symbol",
  err_enter_symbol_company: "Enter the symbol and company name",
  err_enter_coupon_amount: "Enter the coupon and invested amount",
  err_enter_date_term: "Enter the issue date and term",
  err_no_user: "User not found, please sign in again",
  err_save_failed: "Save failed, please try again",
  toast_updated: "Updated {symbol}",
  toast_added: "Added {symbol} to your portfolio",

  sec_source: "Bond data from the SEC Open Data API",
  manual_hint: "For bonds not yet in the SEC database",
  bond_info: "Bond info",
  symbol_field: "Symbol",
  yield_section: "Yield",
  coupon_word: "Coupon",
  per_year: "p.a.",
  maturity: "Matures",
  review: "Review",
  invested_amount: "Invested amount",
  no_credit_info: "No credit rating",
  add_own: 'Add "{term}" manually',
  toast_updated_amount: "Updated {symbol} to ฿{amount}",
  toast_removed_generic: "Bond removed",
  err_save_failed_short: "Save failed",
};

function fmt(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

export type TFn = (key: keyof typeof TH, vars?: Record<string, string | number>) => string;

// Hook: returns a t() bound to the live language.
export function useT(): TFn {
  const lang = useLang();
  const dict = lang === "en" ? EN : TH;
  return (key, vars) => fmt(dict[key] ?? TH[key] ?? String(key), vars);
}
