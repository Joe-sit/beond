import { useEffect, useMemo, useState } from "react";
import { IconCircleCheck, IconClockHour4, IconPencilPlus, IconChecklist, IconScan } from "@tabler/icons-react";
import type { TimelinePayout } from "../data/mockData";
import { useTaxCredits, useTimeline, useViewedYear, notifyPortfolioChanged } from "../hooks/usePortfolio";
import { supabase, supabaseEnabled } from "../lib/supabase";
import { issuerName } from "../lib/issuerLogo";
import IssuerLogo from "./IssuerLogo";
import EditTaxDocModal, { type Draft } from "./EditTaxDocModal";

const THAI_MONTH_INDEX: Record<string, number> = {
  มกราคม: 0, กุมภาพันธ์: 1, มีนาคม: 2, เมษายน: 3, พฤษภาคม: 4, มิถุนายน: 5,
  กรกฎาคม: 6, สิงหาคม: 7, กันยายน: 8, ตุลาคม: 9, พฤศจิกายน: 10, ธันวาคม: 11,
};
const MONTH_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// Opens the beond LINE OA chat with "สแกน" pre-typed — the bot replies with the
// photo instructions and the user sends the real slip (primary logging path).
const LINE_SCAN_URL = `https://line.me/R/oaMessage/%40085vmjoz/?${encodeURIComponent("สแกน")}`;

type SyncStatus = "synced" | "due" | "upcoming";

interface Row {
  payout: TimelinePayout;
  monthIdx: number;
  yearCE: number;
  status: SyncStatus;
}

// Per-installment sync tracker (จัดการภาษี panel): each coupon of the viewed
// year shows whether its 50-ทวิ record is already saved (synced against
// tax_documents by bond + month) and, when due, a shortcut to log it — prefilled
// with the bond's remembered payer tax id and the expected amounts.
export default function CouponSyncCard() {
  const { docs } = useTaxCredits();
  // Same year the timeline chart is showing (shared store), else current year.
  const { months: timeline } = useTimeline();
  const viewedYear = useViewedYear();
  const months = useMemo(() => {
    const years = [...new Set(timeline.map((m) => m.year))].sort();
    const year = viewedYear && years.includes(viewedYear)
      ? viewedYear
      : String(new Date().getFullYear() + 543);
    return timeline.filter((m) => m.year === year);
  }, [timeline, viewedYear]);
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryInitial, setEntryInitial] = useState<Partial<Draft> | undefined>();

  // bond symbol → payer tax id (bound once on a confirmed scan; migration 0017).
  const [taxIds, setTaxIds] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (!supabaseEnabled || !supabase) return;
    supabase
      .from("bonds")
      .select("symbol, payer_tax_id")
      .not("payer_tax_id", "is", null)
      .then(({ data }) => {
        setTaxIds(new Map((data ?? []).map((b) => [String(b.symbol), String(b.payer_tax_id)])));
      });
  }, []);

  const now = new Date();
  const rows: Row[] = useMemo(() => {
    const confirmed = docs.filter((d) => d.status === "confirmed" && d.payDate);
    const out: Row[] = [];
    for (const m of months) {
      const monthIdx = THAI_MONTH_INDEX[m.month] ?? -1;
      const yearCE = Number(m.year) - 543;
      for (const p of m.payouts) {
        // The exact payout day is derived, not official — so a slip counts as
        // this installment's record when bond + month + year match.
        const synced = confirmed.some((d) => {
          if (d.symbol !== p.symbol) return false;
          const dd = new Date(d.payDate!);
          return dd.getFullYear() === yearCE && dd.getMonth() === monthIdx;
        });
        const due =
          yearCE < now.getFullYear() ||
          (yearCE === now.getFullYear() && monthIdx <= now.getMonth());
        out.push({
          payout: p,
          monthIdx,
          yearCE,
          status: synced ? "synced" : due ? "due" : "upcoming",
        });
      }
    }
    return out;
  }, [months, docs, now]);

  if (!rows.length) return null;
  const syncedCount = rows.filter((r) => r.status === "synced").length;

  // Log this installment: open manual entry seeded with everything we know —
  // bond, issuer, the remembered payer tax id, and the schedule's amounts
  // (payout amount = gross; WHT 15%).
  const logInstallment = (r: Row) => {
    const gross = r.payout.amount;
    const wht = Math.round(gross * 0.15 * 100) / 100;
    const net = Math.round((gross - wht) * 100) / 100;
    setEntryInitial({
      payer_name: issuerName(r.payout.symbol, r.payout.issuer),
      payer_tax_id: taxIds.get(r.payout.symbol) ?? "",
      bond_symbol: r.payout.symbol,
      net_amount: String(net),
      gross_amount: String(gross),
      wht_amount: String(wht),
      wht_rate: "15",
      pay_date: r.payout.payoutISO ?? "",
      tax_year: String(r.yearCE + 543),
    });
    setEntryOpen(true);
  };

  return (
    <div className="mt-6 rounded-3xl border border-[#E7E7E7] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#43507F]/5 text-[#43507F]">
            <IconChecklist size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-[#43507F]">เก็บใบ 50 ทวิ รายงวด</p>
            <p className="text-[11px] text-black/45">ไล่เก็บใบจริงของแต่ละงวด — สแกนผ่าน LINE ได้เลย</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-[#43507F]/5 px-2.5 py-1 font-nunito text-[11px] font-bold text-[#43507F]">
          {syncedCount}/{rows.length}
        </span>
      </div>

      <ul className="mt-3 flex flex-col gap-1.5">
        {rows.map((r) => {
          const p = r.payout;
          return (
            <li
              key={p.id}
              className={`flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 ${
                r.status === "due" ? "border-amber-200 bg-amber-50/60" : "border-[#EEECE9]"
              }`}
            >
              <span className="w-9 shrink-0 text-center">
                <span className="block text-[11px] font-bold text-[#43507F]">{MONTH_ABBR[r.monthIdx] ?? "-"}</span>
                <span className="block font-nunito text-[10px] text-black/40">{r.yearCE + 543}</span>
              </span>
              <IssuerLogo symbol={p.symbol} name={issuerName(p.symbol, p.issuer)} size={30} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-nunito text-xs font-bold text-[#1A2233]">{p.symbol}</p>
                <p className="text-[10px] text-black/45">
                  งวด <span className="font-nunito">{p.installment}</span> · ฿
                  <span className="font-nunito">{p.amount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </p>
              </div>
              {r.status === "synced" ? (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#12BC59]/10 px-2 py-1 text-[10px] font-bold text-[#12BC59]">
                  <IconCircleCheck size={13} /> บันทึกแล้ว
                </span>
              ) : r.status === "due" ? (
                <span className="flex shrink-0 items-center gap-1">
                  {/* Primary: collect the real slip via LINE OCR */}
                  <a
                    href={LINE_SCAN_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 rounded-full bg-[#43507F] px-2.5 py-1.5 text-[10px] font-bold text-white active:scale-95"
                  >
                    <IconScan size={13} /> สแกนใบ
                  </a>
                  {/* Fallback: log by hand from the schedule's expectation */}
                  <button
                    onClick={() => logInstallment(r)}
                    aria-label="จดบันทึกเอง"
                    title="จดบันทึกเอง (ไม่มีใบ)"
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-[#43507F]/25 text-[#43507F] active:scale-95"
                  >
                    <IconPencilPlus size={13} />
                  </button>
                </span>
              ) : (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-black/5 px-2 py-1 text-[10px] font-medium text-black/40">
                  <IconClockHour4 size={13} /> ยังไม่ถึงกำหนด
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <EditTaxDocModal
        doc={null}
        open={entryOpen}
        initial={entryInitial}
        onClose={() => setEntryOpen(false)}
        onSaved={notifyPortfolioChanged}
      />
    </div>
  );
}
