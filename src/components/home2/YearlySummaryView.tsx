import { useEffect, useMemo, useRef, useState } from "react";
import { toast, Select, ListBox } from "@heroui/react";
import { AnimatePresence, motion } from "motion/react";
import { IconCheck, IconAlertTriangle, IconFileText } from "@tabler/icons-react";
import { matchConfirmedPayouts, useTimeline, useViewedYear, currentTaxYearBE, type TaxDoc } from "../../hooks/usePortfolio";
import {
  buildEfilingRows,
  countUnfilable,
  detectExtension,
  syncToExtension,
} from "../../lib/efilingSync";
import CoinWall, { type CoinItem } from "./CoinWall";
import JarWidget from "./JarWidget";
import EfilingSealOverlay, { SEAL_AT } from "./EfilingSealOverlay";
import TaxReportPrint from "./TaxReportPrint";
import { getIssuerLogoUrl, issuerName } from "../../lib/issuerLogo";

const fmtTHB = (n: number) =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

// The RD e-Filing page the extension autofills: ภ.ง.ด.90/91 for one tax year.
// The year is the last path segment in พ.ศ., so it follows the year the user is
// summarising rather than being pinned to whatever was current when this was
// written. RD keeps older years reachable, so a back-year filing lands right.
const efilingUrl = (yearBE: number) =>
  `https://efiling.rd.go.th/rd-efiling-web/tax/pit/pnd9091/${yearBE}`;

// Centre-stage box the jar flies to during the seal celebration, and the camera
// zoom that fills it (the panel docks at 38).
const STAGE_W = 420;
const STAGE_H = 520;
const STAGE_ZOOM = 76;
const CHROME_STORE_URL = "https://chromewebstore.google.com/"; // TODO: /detail/<beond-ext-id>

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
  const matched = useMemo(() => matchConfirmedPayouts(months, docs), [months, docs]);

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
    for (const m of months) {
      if (m.year !== beY) continue;
      for (const p of m.payouts) {
        const doc = matched.get(p.id);
        out.push({
          id: p.id,
          symbol: p.symbol,
          issuer: p.issuer,
          monthLabel: monthAbbr(m.month),
          collected: !!doc,
          wht: doc?.whtAmount ?? p.amount * 0.15,
          gross: doc?.grossAmount ?? p.amount,
        });
      }
    }
    return out;
  }, [months, matched, year]);

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
  const totalSlips = coins.length;
  const collectedSlips = jarTokens.length;
  const claimableTotal = useMemo(
    () => coins.reduce((s, c) => (c.collected ? s + c.wht : s), 0),
    [coins],
  );
  // Total gross coupon interest (before WHT): "collected" = only confirmed
  // slips; "all" = every expected coupon this year (collected or not).
  const grossCollected = useMemo(
    () => coins.reduce((s, c) => (c.collected ? s + c.gross : s), 0),
    [coins],
  );
  const grossAll = useMemo(() => coins.reduce((s, c) => s + c.gross, 0), [coins]);
  const [grossMode, setGrossMode] = useState<"collected" | "all">("collected");
  const grossTotal = grossMode === "collected" ? grossCollected : grossAll;

  // Extension presence — gates the sync button. `synced` unlocks the "open
  // e-Filing" step once rows are pushed.
  const [hasExt, setHasExt] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  // Seal celebration. `celebrate` puts the jar on the centre stage; `sealed`
  // starts the lid + sticker, held back until the jar has finished flying so the
  // two motions don't fight each other.
  const [celebrate, setCelebrate] = useState(false);
  const [sealed, setSealed] = useState(false);
  const recheckExt = () => { setHasExt(null); detectExtension().then(setHasExt); };
  useEffect(() => {
    detectExtension().then(setHasExt);
  }, []);
  // A fresh set of rows (year change / edits) invalidates a previous sync.
  useEffect(() => { setSynced(false); }, [rows]);

  // Where the jar sits in the side panel. The jar itself lives in a fixed layer
  // (so it can fly to the centre without ever remounting — a remount would drop
  // the coin pile and reset the WebGL context); this measured rect is the
  // "docked" target it animates back to.
  const slotRef = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  useEffect(() => {
    const el = slotRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSlot({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, []);

  // Export PDF — mount the printable report, let the browser lay it out (and
  // settle webfonts), then open the print dialog where the user picks "Save as
  // PDF". Unmounted again once printing ends so it never costs anything on
  // screen. `onafterprint` doesn't fire in every browser, hence the fallback.
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    if (!printing) return;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setPrinting(false);
    };
    window.addEventListener("afterprint", finish);
    const raf = requestAnimationFrame(() => {
      // Two frames + a beat: the portal must be painted before print snapshots it.
      setTimeout(() => {
        window.print();
        setTimeout(finish, 800);
      }, 120);
    });
    return () => {
      window.removeEventListener("afterprint", finish);
      cancelAnimationFrame(raf);
    };
  }, [printing]);
  const printReport = () => {
    if (!yearDocs.length) return;
    setPrinting(true);
  };

  const onSync = async () => {
    if (!rows.length) return;
    setSyncing(true);
    const ok = await syncToExtension(rows);
    setSyncing(false);
    if (!ok) { toast.danger("ส่งไม่สำเร็จ — ตรวจสอบ extension"); return; }
    setSynced(true);
    setCelebrate(true);
    // Beat 2 of the celebration — the jar has landed, now seal it. Shares the
    // overlay's timeline so the lid drops exactly as the caption changes.
    setTimeout(() => setSealed(true), SEAL_AT);
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
        <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={printReport}
          disabled={!yearDocs.length}
          className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium text-ink transition hover:bg-black/5 disabled:opacity-40 disabled:hover:bg-white"
          title={yearDocs.length ? "บันทึกเป็น PDF หรือสั่งพิมพ์" : "ยังไม่มีสลิปในปีนี้"}
        >
          <IconFileText size={18} /> PDF
        </button>
        {years.length > 0 && (
          <Select
            selectedKey={year != null ? String(year) : null}
            onSelectionChange={(k) => k != null && setYear(Number(k))}
          >
            <Select.Trigger className="flex min-w-32 items-center justify-between gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {years.map((y) => (
                  <ListBox.Item key={y} id={String(y)}>
                    ปีภาษี {y}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        )}
        </div>
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
                  <p className="truncate text-sm text-ink/50">{issuerName(g.symbol, g.issuer)}</p>
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
      {/* Reserved space only — the jar is rendered in the fixed layer below so
          it can fly to the celebration stage without remounting. */}
      <div ref={slotRef} className="relative min-h-0 flex-1" />
      <div className="shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink/60">เก็บแล้ว</span>
          <span className="font-nunito text-lg font-medium text-ink">{collectedSlips}/{totalSlips} ใบ</span>
        </div>
        <div className="h-px bg-black/10" />
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm leading-snug text-ink/60">รายได้ดอกเบี้ย<br />(ก่อนหักภาษี)</span>
            {/* Toggle: collected slips vs every expected coupon this year. */}
            <div className="flex shrink-0 rounded-full bg-black/5 p-0.5 text-xs">
              {(["collected", "all"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setGrossMode(m)}
                  className={`cursor-pointer rounded-full px-2.5 py-1 font-medium transition ${
                    grossMode === m ? "bg-white text-ink shadow-sm" : "text-ink/50 hover:text-ink/80"
                  }`}
                >
                  {m === "collected" ? "สะสมได้" : "ทั้งปี"}
                </button>
              ))}
            </div>
          </div>
          <span className="text-right font-nunito text-lg font-medium text-ink">฿{fmtTHB(grossTotal)}</span>
        </div>
        <div className="h-px bg-black/10" />
        <div className="flex items-end justify-between">
          <span className="text-sm text-ink/60">ขอคืนได้รวม</span>
          <span className="font-nunito text-2xl font-medium text-[#2E8B57]">฿{fmtTHB(claimableTotal)}</span>
        </div>
        <div className="h-px bg-black/10" />

        {/* Fill flow: (1) install extension → (2) send rows → (3) open e-Filing */}
        {hasExt === false ? (
          // Not installed — Chrome Web Store install card + re-check.
          <div className="flex flex-col gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium text-amber-800">
              <IconAlertTriangle size={16} className="shrink-0" /> ต้องติดตั้ง beond extension ก่อน
            </p>
            <p className="text-xs leading-relaxed text-amber-800/80">
              ส่วนเสริม Chrome ที่กรอกข้อมูลลง e-Filing ให้อัตโนมัติ
            </p>
            <a
              href={CHROME_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 items-center justify-center rounded-xl bg-brand-blue px-4 text-sm font-medium text-white transition hover:bg-[#215688]"
            >
              ติดตั้งจาก Chrome Web Store
            </a>
            <button onClick={recheckExt} className="text-xs font-medium text-brand-blue underline">
              ติดตั้งแล้ว — ตรวจสอบอีกครั้ง
            </button>
          </div>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-ink/50">
            {hasExt == null ? (
              "กำลังตรวจสอบ extension…"
            ) : (
              <>
                <IconCheck size={14} className="text-[#3FA35B]" stroke={3} /> พบ beond extension แล้ว
              </>
            )}
          </p>
        )}

        {/* Step 2 — push the fileable rows into the extension's storage. */}
        <button
          onClick={onSync}
          disabled={!hasExt || !rows.length || syncing}
          className="flex h-[54px] w-full items-center justify-center rounded-2xl bg-brand-blue px-4 text-base font-medium text-white transition hover:bg-[#215688] disabled:opacity-40"
        >
          {syncing ? "กำลังส่ง…" : synced ? `ส่งอีกครั้ง (${rows.length})` : `ส่งเข้า e-Filing (${rows.length})`}
        </button>

        {/* Step 3 — open the RD site; the extension autofills the pushed rows.
            Shown only after a successful sync (manual, per user's choice). */}
        {synced && (
          <a
            href={year == null ? "https://efiling.rd.go.th/" : efilingUrl(year)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-[54px] w-full items-center justify-center gap-2 rounded-2xl border border-[#2E8B57] px-4 text-base font-medium text-[#2E8B57] transition hover:bg-[#2E8B57]/5"
          >
            เปิด e-Filing เพื่อกรอก
          </a>
        )}
      </div>
    </aside>

    {/* Printable report — hidden on screen, swapped in by the print stylesheet. */}
    {printing && (
      <TaxReportPrint
        year={year}
        rows={rows}
        docs={yearDocs.filter((d) => d.status === "confirmed")}
        unfilable={unfilable}
      />
    )}

    {/* Sent-to-e-Filing celebration — backdrop + chrome only. */}
    <AnimatePresence>
      {celebrate && (
        <EfilingSealOverlay rowCount={rows.length} year={year} onDone={() => setCelebrate(false)} />
      )}
    </AnimatePresence>

    {/* THE jar — one instance for the whole view, parked over its panel slot and
        flown to the centre stage for the celebration. Animating top/left/width/
        height (never `transform: scale`) keeps r3f's ResizeObserver in the loop,
        so the canvas re-measures as it grows instead of rendering cropped. */}
    {slot && (
      <motion.div
        className="pointer-events-none fixed z-[131]"
        initial={false}
        animate={
          celebrate
            ? {
                top: `calc(50% - ${STAGE_H / 2}px)`,
                left: `calc(50% - ${STAGE_W / 2}px)`,
                width: STAGE_W,
                height: STAGE_H,
              }
            : { top: slot.top, left: slot.left, width: slot.width, height: slot.height }
        }
        transition={{ type: "spring", stiffness: 80, damping: 20, mass: 1 }}
      >
        <JarWidget
          coins={jarTokens}
          sealed={sealed || synced}
          zoom={celebrate ? STAGE_ZOOM : 38}
          className="h-full w-full"
        />
      </motion.div>
    )}
    </div>
  );
}

