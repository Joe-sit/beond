import { useEffect, useMemo, useState } from "react";
import { toast } from "@heroui/react";
import { IconInfoCircle, IconCheck, IconX, IconPencil } from "@tabler/icons-react";
import { matchConfirmedPayouts, notifyPortfolioChanged, useHoldings, useTimeline, useViewedYear, currentTaxYearBE, type TaxDoc } from "../../hooks/usePortfolio";
import { supabase } from "../../lib/supabase";
import {
  buildEfilingRows,
  countUnfilable,
  detectExtension,
  syncToExtension,
} from "../../lib/efilingSync";
import CoinWall, { type CoinItem } from "./CoinWall";
import JarWidget from "./JarWidget";
import { getIssuerLogoUrl } from "../../lib/issuerLogo";

const fmtTHB = (n: number) =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

// 13-digit tax id → 0-0000-00000-00-0 for display.
const fmtTaxId = (id: string) => {
  const d = id.replace(/\D/g, "");
  if (d.length !== 13) return id;
  return `${d[0]}-${d.slice(1, 5)}-${d.slice(5, 10)}-${d.slice(10, 12)}-${d[12]}`;
};

// Full Thai month name (as the timeline stores it) → short label for the coin
// calendar slots.
const THAI_MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const THAI_MONTHS_ABBR = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];
const monthAbbr = (fullName: string) => {
  const i = THAI_MONTHS_FULL.indexOf(fullName);
  return i >= 0 ? THAI_MONTHS_ABBR[i] : "";
};

// Yearly tax overview (Figma TBD). Two data planes kept deliberately separate:
//  • DISPLAY   — all confirmed slips for the year (KPIs, per-payer table).
//  • FILEABLE  — the exact 40(4) rows the beond extension autofills into
//                efiling.rd.go.th. Only confirmed slips with a valid 13-digit
//                payer id qualify; the rest surface as a fix-me warning.
export default function YearlySummaryView({ docs }: { docs: TaxDoc[] }) {
  // Expected coupon payouts across the whole timeline — the ceiling of what's
  // collectable. A confirmed slip matched to a payout = "collected".
  const { months } = useTimeline();
  const { holdings } = useHoldings();
  const matched = useMemo(() => matchConfirmedPayouts(months, docs), [months, docs]);

  // Canonical payer id per bond symbol (bonds.payer_tax_id) + the bond id so it
  // can be edited in place. Held bonds only; deleted ones fall back to the OCR
  // value from the slip.
  const bondBySymbol = useMemo(() => {
    const m = new Map<string, { bondId: string; taxId: string | null }>();
    for (const h of holdings) if (!m.has(h.symbol)) m.set(h.symbol, { bondId: h.bondId, taxId: h.payerTaxId });
    return m;
  }, [holdings]);

  // Years with either an expected payout (BE string on the month) or a slip.
  // Newest first.
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const m of months) if (m.payouts.length) set.add(Number(m.year));
    for (const d of docs) if (d.taxYear != null) set.add(d.taxYear);
    return [...set].filter((y) => Number.isFinite(y)).sort((a, b) => b - a);
  }, [months, docs]);

  // Open on the same year the home chart/jar is showing (BE), so the collected
  // slips there line up with this summary. Fall back to the current tax year,
  // then the newest year with data.
  const viewedBE = useViewedYear();
  const defaultYear = useMemo(() => {
    if (!years.length) return null;
    for (const cand of [Number(viewedBE), currentTaxYearBE()]) {
      if (Number.isFinite(cand) && years.includes(cand)) return cand;
    }
    return years[0];
  }, [years, viewedBE]);

  const [year, setYear] = useState<number | null>(null);
  useEffect(() => {
    if (year == null && defaultYear != null) setYear(defaultYear);
  }, [defaultYear, year]);

  const rows = useMemo(() => (year == null ? [] : buildEfilingRows(docs, year)), [docs, year]);
  const unfilable = useMemo(() => (year == null ? 0 : countUnfilable(docs, year)), [docs, year]);

  const yearDocs = useMemo(
    () => docs.filter((d) => d.taxYear === year),
    [docs, year],
  );
  const pendingCount = yearDocs.filter((d) => d.status === "pending").length;

  // Coins = every expected payout this year (from the timeline) plus any
  // confirmed slip that has no matching payout left (e.g. the bond was removed
  // after collecting). Collected ones carry a confirmed slip; the rest are still
  // owed. WHT = the matched slip's actual withholding, or a 15% estimate for
  // payouts not yet collected.
  const coins = useMemo<CoinItem[]>(() => {
    if (year == null) return [];
    const beY = String(year);
    const out: CoinItem[] = [];
    const usedDocIds = new Set<string>();
    for (const m of months) {
      if (m.year !== beY) continue;
      for (const p of m.payouts) {
        const doc = matched.get(p.id);
        if (doc) usedDocIds.add(doc.id);
        out.push({
          id: p.id,
          symbol: p.symbol,
          issuer: p.issuer,
          monthLabel: monthAbbr(m.month),
          collected: !!doc,
          wht: doc?.whtAmount ?? p.amount * 0.15,
        });
      }
    }
    // Confirmed slips with no payout in the timeline (bond deleted, or a slip
    // ahead of the schedule) — still show them as collected coins so the year's
    // collection isn't lost.
    for (const d of docs) {
      if (d.taxYear !== year || d.status !== "confirmed" || usedDocIds.has(d.id)) continue;
      out.push({
        id: d.id,
        symbol: d.symbol ?? "—",
        issuer: d.payerName ?? "—",
        monthLabel: d.payDate ? THAI_MONTHS_ABBR[new Date(d.payDate).getMonth()] : "",
        collected: true,
        wht: d.whtAmount ?? 0,
      });
    }
    return out;
  }, [months, matched, year, docs]);

  // Per-bond groups (Figma 1090:3553): each bond gets its own header + coin
  // panel + a claimable-tax total. `claimable` = WHT on the slips actually
  // collected (matched) — what you can file to reclaim.
  const bondGroups = useMemo(() => {
    const map = new Map<string, { symbol: string; issuer: string; items: CoinItem[]; claimable: number }>();
    for (const c of coins) {
      const g = map.get(c.symbol) ?? { symbol: c.symbol, issuer: c.issuer, items: [], claimable: 0 };
      g.items.push(c);
      if (c.collected) g.claimable += c.wht;
      map.set(c.symbol, g);
    }
    return [...map.values()];
  }, [coins]);

  // Right-panel jar: every collected slip this year piled as an issuer coin, plus
  // headline totals.
  const jarTokens = useMemo(
    () => coins.filter((c) => c.collected).map((c) => ({ id: c.id, symbol: c.symbol })),
    [coins],
  );
  // Payer 13-digit tax id per bond symbol (from confirmed slips) — shown under
  // the symbol in each group header.
  const taxIdBySymbol = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of docs) {
      if (!d.symbol || map.has(d.symbol)) continue;
      const id = (d.payerTaxId ?? "").replace(/\D/g, "");
      if (id.length === 13) map.set(d.symbol, id);
    }
    return map;
  }, [docs]);

  const totalSlips = coins.length;
  const collectedSlips = jarTokens.length;
  const claimableTotal = useMemo(
    () => coins.reduce((s, c) => (c.collected ? s + c.wht : s), 0),
    [coins],
  );

  // Extension presence — gates the sync button.
  const [hasExt, setHasExt] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  useEffect(() => {
    detectExtension().then(setHasExt);
  }, []);

  const onSync = async () => {
    if (!rows.length) return;
    setSyncing(true);
    const ok = await syncToExtension(rows);
    setSyncing(false);
    if (ok) toast.success(`ส่ง ${rows.length} รายการเข้า e-Filing แล้ว`);
    else toast.danger("ส่งไม่สำเร็จ — ตรวจสอบ extension");
  };

  return (
    <div className="flex h-full min-h-0 w-full gap-4">
    <section className="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-y-auto rounded-3xl bg-white p-6">
      {/* Header + year picker */}
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex w-[339px] max-w-full flex-col gap-2">
          <p className="text-sm text-ink/60">สรุปภาษีประจำปี</p>
          <h2 className="text-2xl font-medium text-ink">การสะสมสลิปประจำปี {year}</h2>
        </div>
        {years.length > 0 && (
          <select
            value={year ?? ""}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                ปีภาษี {y}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Readiness warnings */}
      {(pendingCount > 0 || unfilable > 0) && (
        <div className="flex shrink-0 flex-col gap-1 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          {pendingCount > 0 && <span>• {pendingCount} สลิปยังไม่ยืนยัน — จะไม่ถูกยื่น</span>}
          {unfilable > 0 && <span>• {unfilable} สลิปไม่มีเลขผู้เสียภาษี 13 หลัก — ยื่นไม่ได้ ต้องแก้ก่อน</span>}
        </div>
      )}

      {/* Per-bond collection groups (Figma 1090:3553): a header (symbol + issuer
          + logo) over a gray panel of that bond's coins, with the claimable-tax
          total. ✓ = เก็บแล้ว (slip matched), จาง = ยังไม่เก็บ (still owed). */}
      {bondGroups.length === 0 ? (
        <p className="shrink-0 rounded-2xl border border-line py-8 text-center text-sm text-ink/40">
          ยังไม่มีดอกเบี้ยในปีนี้
        </p>
      ) : (
        bondGroups.map((g) => {
          const logo = getIssuerLogoUrl(g.symbol);
          return (
            <div key={g.symbol} className="shrink-0 overflow-hidden rounded-2xl border border-line">
              {/* Bond header */}
              <div className="flex items-center justify-between gap-4 bg-white px-6 py-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="truncate text-2xl font-medium text-ink">{g.symbol}</p>
                  <PayerTaxIdField
                    issuer={g.issuer}
                    bondId={bondBySymbol.get(g.symbol)?.bondId ?? null}
                    value={bondBySymbol.get(g.symbol)?.taxId ?? taxIdBySymbol.get(g.symbol) ?? null}
                  />
                </div>
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-white">
                  {logo ? (
                    <img src={logo} alt="" className="size-full object-contain p-2" />
                  ) : (
                    <span className="text-lg font-medium text-ink/40">{g.symbol.slice(0, 2)}</span>
                  )}
                </div>
              </div>
              {/* Coin panel + claimable total */}
              <div className="flex flex-col gap-10 border-t border-black/10 bg-[#f5f5f5] p-6">
                <CoinWall coins={g.items} showValue={false} />
                <div className="flex items-start justify-between gap-4">
                  <p className="text-base text-ink/60">ที่ต้องสะสมทั้งหมด {g.items.length} ใบ</p>
                  <div className="flex flex-col items-end gap-1 text-right">
                    <p className="font-nunito text-2xl font-medium text-ink">฿{fmtTHB(g.claimable)}</p>
                    <p className="text-base text-ink/60">ขอคืนได้</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </section>

    {/* Right panel — glass jar of this year's collected slips + headline totals
        + the e-Filing sync action. */}
    <aside className="flex h-full w-[300px] shrink-0 flex-col overflow-hidden rounded-3xl bg-white p-6">
      <p className="shrink-0 text-sm text-ink/60">ขวดสะสมสลิปปี {year}</p>
      <div className="relative min-h-0 flex-1">
        <JarWidget coins={jarTokens} />
      </div>
      <div className="shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink/60">เก็บแล้ว</span>
          <span className="font-nunito text-lg font-medium text-ink">{collectedSlips}/{totalSlips} ใบ</span>
        </div>
        <div className="h-px bg-black/10" />
        <div className="flex items-end justify-between">
          <span className="text-sm text-ink/60">ขอคืนได้รวม</span>
          <span className="font-nunito text-2xl font-medium text-[#2E8B57]">฿{fmtTHB(claimableTotal)}</span>
        </div>
        <div className="h-px bg-black/10" />
        {/* Sync to extension */}
        <p className="text-xs text-ink/50">
          {hasExt == null
            ? "กำลังตรวจสอบ extension…"
            : hasExt
              ? "พบ beond extension"
              : "ไม่พบ extension — ติดตั้งก่อนยื่น"}
        </p>
        <button
          onClick={onSync}
          disabled={!hasExt || !rows.length || syncing}
          className="flex h-[54px] w-full items-center justify-center rounded-2xl bg-brand-blue px-4 text-base font-medium text-white transition hover:bg-[#215688] disabled:opacity-40"
        >
          {syncing ? "กำลังส่ง…" : `ส่งเข้า e-Filing (${rows.length})`}
        </button>
      </div>
    </aside>
    </div>
  );
}

// Payer 13-digit tax id shown under the bond symbol, editable in place when the
// bond is still held (writes bonds.payer_tax_id). Also auto-filled by the 50-ทวิ
// OCR; this is the manual override. No bondId (deleted bond) → read-only.
function PayerTaxIdField({
  issuer,
  bondId,
  value,
}: {
  issuer: string;
  bondId: string | null;
  value: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDraft((value ?? "").replace(/\D/g, ""));
    setEditing(true);
  };

  const save = async () => {
    if (!bondId || !supabase || saving) return;
    const digits = draft.replace(/\D/g, "");
    if (digits.length && digits.length !== 13) return; // 13 digits or clear
    setSaving(true);
    const { error } = await supabase
      .from("bonds")
      .update({ payer_tax_id: digits || null })
      .eq("id", bondId);
    setSaving(false);
    if (error) {
      toast.danger(`บันทึกไม่สำเร็จ: ${error.message}`);
      return;
    }
    notifyPortfolioChanged();
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 13))}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          inputMode="numeric"
          placeholder="เลข 13 หลัก"
          className="w-44 rounded-lg border border-black/15 px-2 py-1 font-nunito text-sm outline-none focus:border-brand-blue"
        />
        <button onClick={save} disabled={saving} className="rounded-md p-1 text-[#3FA35B] transition hover:bg-black/5">
          <IconCheck size={16} />
        </button>
        <button onClick={() => setEditing(false)} className="rounded-md p-1 text-ink/40 transition hover:bg-black/5">
          <IconX size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col">
      <span className="flex items-center gap-1 text-xs text-ink/50">
        เลขผู้จ่ายเงินได้
        <IconInfoCircle
          size={13}
          className="cursor-help text-ink/40"
          title="เลขประจำตัวผู้เสียภาษีอากรของผู้จ่ายเงินได้ ตามหนังสือรับรองการหัก ณ ที่จ่าย"
        />
      </span>
      <span className="flex items-center gap-1.5">
        <span className="truncate font-nunito text-base text-ink/70">
          {value ? fmtTaxId(value) : issuer}
        </span>
        {bondId && (
          <button
            onClick={startEdit}
            aria-label="แก้ไขเลขผู้จ่ายเงินได้"
            className="shrink-0 rounded-md p-0.5 text-ink/40 transition hover:bg-black/5 hover:text-ink/70"
          >
            <IconPencil size={14} />
          </button>
        )}
      </span>
    </div>
  );
}
