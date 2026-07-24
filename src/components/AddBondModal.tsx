import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Modal, ModalBackdrop, ModalContainer, ModalDialog,
  Breadcrumbs, Button, SearchField, Label, NumberField, Accordion, ComboBox, ListBox, Input, DatePicker, Calendar, toast,
} from "@heroui/react";
import { Group, DateInput, DateSegment, Dialog, I18nProvider } from "react-aria-components";
import { parseDate, toCalendar, GregorianCalendar, type DateValue } from "@internationalized/date";
import { ensureCatalog, searchLocal, issuerNames, issuerForSymbol, symbolForIssuer, type BondCandidate } from "../lib/secApi";
import { deriveCouponSchedule } from "../lib/couponSchedule";
import { overrideFor } from "../data/couponOverrides";
import { ratingFor } from "../data/bondRatings";
import { notifyPortfolioChanged, type HoldingDetail } from "../hooks/usePortfolio";
import { supabase, supabaseEnabled } from "../lib/supabase";
import IssuerLogo from "./IssuerLogo";
import { issuerName } from "../lib/issuerLogo";
import { IconCheck, IconChevronDown, IconTrash, IconCalendar } from "@tabler/icons-react";
import emptyBonds from "../assets/empty-bonds.svg";
import addBondMain from "../assets/add-bond-main.png";
import bondEx1 from "../assets/bond-ex-1.png";
import bondEx2 from "../assets/bond-ex-2.png";
import { useT } from "../lib/i18n";

interface AddBondModalProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  initialTerm?: string; // prefill the search (e.g. a bond code OCR'd from a slip)
  inline?: boolean; // render the body in place (no Modal chrome), filling its parent
  editHolding?: HoldingDetail | null; // edit an existing holding instead of adding
  onDelete?: () => void | Promise<void>; // delete the holding being edited
}

// SEC doesn't classify bonds by industry, and the form no longer asks — new
// bonds land in the "unclassified" sector (migration 0015).
const FALLBACK_SECTOR_ID = "other";

// Minimum face value a holding can be added with, and the counter's step.
const MIN_FACE_VALUE = 100_000;
const AMOUNT_PRESETS = [100_000, 500_000, 1_000_000];

const FREQ_KEY = {
  1: "freq_annual",
  2: "freq_semi",
  4: "freq_quarter",
  12: "freq_monthly",
} as const;

const THAI_MONTHS_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// ISO date → Thai Buddhist-era short date, e.g. "2028-08-13" → "13 ส.ค. 2571".
function fmtThaiDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${THAI_MONTHS_ABBR[d.getMonth()]} ${d.getFullYear() + 543}`;
}

// Scroll-fade: mask a scroll container's top/bottom edge only when there's more
// content to scroll toward — same effect as the holdings list.
function useScrollFade<T extends HTMLElement>(dep: unknown) {
  const ref = useRef<T>(null);
  const [edge, setEdge] = useState({ top: false, bottom: false });
  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const top = el.scrollTop > 4;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 4;
    setEdge((c) => (c.top === top && c.bottom === bottom ? c : { top, bottom }));
  };
  useLayoutEffect(() => { onScroll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [dep]);
  useEffect(() => {
    window.addEventListener("resize", onScroll);
    return () => window.removeEventListener("resize", onScroll);
  }, []);
  const FADE = "24px";
  const mask = `linear-gradient(to bottom, ${edge.top ? "transparent" : "black"} 0, black ${FADE}, black calc(100% - ${FADE}), ${edge.bottom ? "transparent" : "black"} 100%)`;
  return { ref, mask, onScroll };
}

// heroUI date picker for the issue date. Bridges the ISO string state
// (mIssue) to react-aria's DateValue.
function IssueDatePicker({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const t = useT();
  let dv: DateValue | null = null;
  try { dv = value ? parseDate(value) : null; } catch { dv = null; }
  return (
    // Thai locale + Buddhist era so the field/calendar read in พ.ศ. like the
    // rest of the app's dates; onChange converts back to a Gregorian ISO string.
    <I18nProvider locale="th-TH-u-ca-buddhist">
    <DatePicker
      aria-label={t("issue_date")}
      value={dv}
      onChange={(v) => onChange(v ? toCalendar(v, new GregorianCalendar()).toString() : "")}
      className="flex flex-1 flex-col gap-1"
    >
      <Label className="text-sm font-medium text-black/60">{t("issue_date")}</Label>
      {/* Whole field opens the calendar: the trigger covers the group and the
          segments are click-through (display only). */}
      <Group className="input relative flex cursor-pointer items-center gap-2">
        <DatePicker.Trigger className="absolute inset-0 z-0" aria-label={t("open_calendar")}>
          <span className="sr-only">{t("open_calendar")}</span>
        </DatePicker.Trigger>
        <DateInput className="pointer-events-none flex flex-1 font-normal">
          {(segment) => (
            <DateSegment
              segment={segment}
              className="rounded px-0.5 tabular-nums outline-none data-[placeholder]:text-black/30"
            />
          )}
        </DateInput>
        <IconCalendar size={18} className="pointer-events-none relative z-10 shrink-0 text-black/50" />
      </Group>
      <DatePicker.Popover>
        <Dialog className="p-3 outline-none">
          <Calendar>
            <header className="flex items-center justify-between px-1 pb-2">
              <Calendar.NavButton slot="previous" />
              <Calendar.Heading className="text-sm font-medium text-[#181D20]" />
              <Calendar.NavButton slot="next" />
            </header>
            <Calendar.Grid className="border-separate border-spacing-1">
              <Calendar.GridHeader>
                {(day) => <Calendar.HeaderCell className="text-xs font-normal text-black/40">{day}</Calendar.HeaderCell>}
              </Calendar.GridHeader>
              <Calendar.GridBody>
                {(date) => (
                  <Calendar.Cell
                    date={date}
                    className="flex size-8 cursor-pointer items-center justify-center rounded-full text-sm outline-none data-[hovered]:bg-black/5 data-[selected]:bg-[#43507F] data-[selected]:text-white data-[disabled]:opacity-30"
                  />
                )}
              </Calendar.GridBody>
            </Calendar.Grid>
          </Calendar>
        </Dialog>
      </DatePicker.Popover>
    </DatePicker>
    </I18nProvider>
  );
}

export default function AddBondModal({ open, onClose, onAdded, initialTerm, inline = false, editHolding = null, onDelete }: AddBondModalProps) {
  const t = useT();
  const editing = !!editHolding;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [manualReview, setManualReview] = useState(false); // summary step before saving a manual entry
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<BondCandidate[]>([]);
  const [selected, setSelected] = useState<BondCandidate | null>(null);
  const [amount, setAmount] = useState<number>(NaN);
  const [rating, setRating] = useState(""); // credit rating; "" → nonRate
  const [freq, setFreq] = useState(2); // coupon payments per year (SEC omits this)
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual entry — for bonds not yet in the SEC feed (e.g. a PO that just closed
  // and isn't settled/registered on ThaiBMA yet).
  const [manual, setManual] = useState(false);
  const [mSymbol, setMSymbol] = useState("");
  const [mIssuer, setMIssuer] = useState("");
  const [mCoupon, setMCoupon] = useState<number>(NaN);
  const [mIssue, setMIssue] = useState("");
  const [mTermY, setMTermY] = useState<number>(NaN); // bond term — years
  const [mTermM, setMTermM] = useState<number>(NaN); // bond term — months
  // Per-group validity — drives the green check on each heading.
  const infoValid = mSymbol.trim() !== "" && mIssuer.trim() !== "";
  const yieldValid = Number.isFinite(mCoupon) && mCoupon > 0 && Number.isFinite(amount) && amount >= MIN_FACE_VALUE;
  const termValid = mIssue !== "" && ((Number.isFinite(mTermY) ? mTermY : 0) * 12 + (Number.isFinite(mTermM) ? mTermM : 0)) > 0;

  // Scroll-fade for the search results (like the holdings list). The manual
  // form can't use it: the heroUI accordion sets `contain`/`will-change` on its
  // panels, and an ancestor `mask-image` over those compositing layers renders
  // solid black in Chrome — so the manual form scrolls without the fade.
  const resultsFade = useScrollFade<HTMLDivElement>(results.length);

  // Debounce the issuer query so the (local) catalog filter + list re-render
  // fire once the user pauses, not on every keystroke.
  const [issuerQuery, setIssuerQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setIssuerQuery(mIssuer.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [mIssuer]);

  // Credit rating for the manual entry — from the symbol prefix, or, when the
  // symbol doesn't resolve, from the chosen company's other bonds. Reactive so
  // picking a company (not just typing a code) updates it.
  const manualRating = useMemo(
    () => ratingFor(mSymbol) ?? ratingFor(symbolForIssuer(mIssuer) ?? "") ?? "",
    [mSymbol, mIssuer],
  );
  useEffect(() => {
    if (manual && !editing) setRating(manualRating);
  }, [manual, editing, manualRating]);

  // Maturity derived from issue date + entered term — for the review summary.
  const manualMaturity = useMemo(() => {
    const months = (Number.isFinite(mTermY) ? mTermY : 0) * 12 + (Number.isFinite(mTermM) ? mTermM : 0);
    if (!mIssue || months <= 0) return null;
    const d = new Date(mIssue);
    d.setMonth(d.getMonth() + months);
    return d.toISOString().slice(0, 10);
  }, [mIssue, mTermY, mTermM]);

  // Company-name suggestions for the manual issuer combobox — filtered by the
  // debounced text, capped so the popover stays light.
  const issuerMatches = useMemo(() => {
    const all = issuerNames();
    const list = issuerQuery ? all.filter((n) => n.toLowerCase().includes(issuerQuery)) : all;
    return list.slice(0, 50).map((n) => ({ id: n, name: n }));
  }, [issuerQuery]);

  // Warm the full bond catalog as soon as the modal opens, so free-text
  // searches (company names) answer locally and instantly.
  useEffect(() => {
    if (open) {
      ensureCatalog();
      if (initialTerm) setTerm(initialTerm); // prefill from an OCR'd bond code
    }
  }, [open, initialTerm]);

  // Editing an existing holding → open straight into the manual form, prefilled.
  useEffect(() => {
    if (!open || !editHolding) return;
    const h = editHolding;
    setManual(true);
    setMSymbol(h.symbol);
    setMIssuer(h.issuer);
    setMCoupon(h.couponRate);
    setAmount(h.faceValue);
    setFreq(h.couponFreq ?? 2);
    setRating(h.rating ?? "");
    setMIssue(h.issueDate ?? "");
    if (h.issueDate && h.maturityDate) {
      const months = Math.max(0, Math.round(
        (new Date(h.maturityDate).getTime() - new Date(h.issueDate).getTime()) / (30.4375 * 864e5),
      ));
      setMTermY(Math.floor(months / 12));
      setMTermM(months % 12);
    }
  }, [open, editHolding]);

  // Realtime, single-stage search: the local catalog answers on every
  // keystroke. No remote round-trip — bonds too new for the snapshot are added
  // via manual entry, and the catalog is refreshed daily.
  useEffect(() => {
    if (!open || selected) return;
    setResults(term.trim().length < 2 ? [] : searchLocal(term));
  }, [term, open, selected]);

  const reset = () => {
    setTerm("");
    setResults([]);
    setSelected(null);
    setAmount(NaN);
    setRating("");
    setFreq(2);
    setError(null);
    setManual(false);
    setMSymbol("");
    setMIssuer("");
    setMCoupon(NaN);
    setMIssue("");
    setMTermY(NaN);
    setMTermM(NaN);
    setConfirmDelete(false);
    setManualReview(false);
  };

  // Build a candidate from the manual form fields.
  const buildManualCandidate = (): BondCandidate | null => {
    const sym = mSymbol.trim().toUpperCase();
    if (!sym) { setError(t("err_enter_symbol")); return null; }
    const y = Number.isFinite(mTermY) ? mTermY : 0;
    const m = Number.isFinite(mTermM) ? mTermM : 0;
    const totalMonths = y * 12 + m;
    const termYears = totalMonths > 0 ? totalMonths / 12 : null;
    // Derive maturity from issue date + term so downstream schedules still work.
    let maturityDate: string | null = null;
    if (mIssue && totalMonths > 0) {
      const d = new Date(mIssue);
      d.setMonth(d.getMonth() + totalMonths);
      maturityDate = d.toISOString().slice(0, 10);
    }
    return {
      symbol: sym,
      nameTh: mIssuer.trim() || sym,
      nameEn: "",
      isin: "",
      issuer: mIssuer.trim() || sym,
      couponRate: Number.isFinite(mCoupon) ? mCoupon : null,
      maturityDate,
      issueDate: mIssue || null,
      termYears,
      frequency: freq,
      source: "manual",
    };
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // Manual flow: the header button opens a summary step; the summary confirms.
  const goManualReview = () => {
    if (!infoValid) { setError(t("err_enter_symbol_company")); return; }
    if (!yieldValid) { setError(t("err_enter_coupon_amount")); return; }
    if (!termValid) { setError(t("err_enter_date_term")); return; }
    setError(null);
    setManualReview(true);
  };
  const saveManual = () => {
    const c = buildManualCandidate();
    if (c) handleSave(c);
  };

  // `cand` defaults to the selected bond (SEC flow); the manual flow passes its
  // freshly-built candidate so it can save without a separate confirm step.
  const handleSave = async (cand: BondCandidate | null = selected) => {
    if (!cand || saving) return;
    const faceValue = amount;
    if (!Number.isFinite(faceValue) || faceValue < MIN_FACE_VALUE) {
      setError(`จำนวนเงินลงทุนขั้นต่ำ ${MIN_FACE_VALUE.toLocaleString("th-TH")} บาท`);
      return;
    }
    if (!supabaseEnabled || !supabase) {
      handleClose();
      onAdded();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // The signed-in user's public.users id is carried in the session JWT's
      // app_metadata (set by the line-auth function). RLS keys on it.
      const { data: authData } = await supabase.auth.getUser();
      const publicUserId = authData.user?.app_metadata?.public_user_id as string | undefined;
      if (!publicUserId) throw new Error(t("err_no_user"));

      // Real coupon schedule derived from the bond's attributes.
      const schedule = deriveCouponSchedule({
        issueDate: cand.issueDate,
        maturityDate: cand.maturityDate,
        termYears: cand.termYears,
        frequency: freq, // user-picked; SEC omits payment frequency
        couponRate: cand.couponRate,
        faceValue,
      });

      // Edit mode: update the existing bond + holding, regenerate payouts.
      if (editHolding) {
        const { error: bondErr } = await supabase
          .from("bonds")
          .update({
            issuer: cand.issuer,
            coupon_rate: cand.couponRate ?? 0,
            maturity_date: cand.maturityDate,
            issue_date: cand.issueDate,
            coupon_freq: freq,
            rating: rating || null,
          })
          .eq("id", editHolding.bondId);
        if (bondErr) throw bondErr;
        const { error: upErr } = await supabase
          .from("holdings").update({ face_value: faceValue }).eq("id", editHolding.id);
        if (upErr) throw upErr;
        await supabase.from("payouts").delete().eq("holding_id", editHolding.id);
        if (schedule.length) {
          const { error: payErr } = await supabase.from("payouts").insert(
            schedule.map((p) => ({
              holding_id: editHolding.id,
              installment: p.installment,
              amount: p.amount,
              payout_date: p.date,
            })),
          );
          if (payErr) throw payErr;
        }
        notifyPortfolioChanged();
        toast.success(t("toast_updated", { symbol: cand.symbol }));
        handleClose();
        onAdded();
        return;
      }

      let { data: bond } = await supabase
        .from("bonds")
        .select("id")
        .eq("symbol", cand.symbol)
        .maybeSingle();

      if (!bond) {
        const { data: inserted, error: bondErr } = await supabase
          .from("bonds")
          .insert({
            symbol: cand.symbol,
            issuer: cand.issuer,
            sector_id: FALLBACK_SECTOR_ID,
            coupon_rate: cand.couponRate ?? 0,
            total_installments:
              schedule.length ||
              (cand.termYears ? Math.max(1, Math.round(cand.termYears * 2)) : 4),
            maturity_date: cand.maturityDate,
            issue_date: cand.issueDate,
            coupon_freq: freq,
            rating: rating || null,
          })
          .select("id")
          .single();
        if (bondErr) throw bondErr;
        bond = inserted;
      }

      const { data: holding, error: holdErr } = await supabase
        .from("holdings")
        .insert({
          user_id: publicUserId,
          bond_id: bond!.id,
          face_value: faceValue,
        })
        .select("id")
        .single();
      if (holdErr) throw holdErr;

      // Seed this holding's payout timeline from the derived schedule.
      if (holding && schedule.length) {
        const { error: payErr } = await supabase.from("payouts").insert(
          schedule.map((p) => ({
            holding_id: holding.id,
            installment: p.installment,
            amount: p.amount,
            payout_date: p.date,
          })),
        );
        if (payErr) throw payErr;
      }

      notifyPortfolioChanged();
      toast.success(t("toast_added", { symbol: cand.symbol }));
      handleClose();
      onAdded();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("err_save_failed");
      setError(msg);
      toast.danger(msg);
    } finally {
      setSaving(false);
    }
  };

  const body = (
    <>
        <div className="relative flex items-start justify-between">
          <div className="min-w-0">
            {/* Breadcrumb replaces the close button — each crumb steps back a
                level (เพิ่มหุ้นกู้ → closes; ค้นหา → back to search). */}
            <Breadcrumbs separator="/">
              {editing ? (
                <>
                  <Breadcrumbs.Item onPress={handleClose}>{t("holdings_title")}</Breadcrumbs.Item>
                  <Breadcrumbs.Item>{t("edit")}</Breadcrumbs.Item>
                </>
              ) : (
                <>
                  <Breadcrumbs.Item onPress={handleClose}>{t("add_bond")}</Breadcrumbs.Item>
                  <Breadcrumbs.Item onPress={() => { setSelected(null); setManual(false); setError(null); }}>{t("search")}</Breadcrumbs.Item>
                  {selected && <Breadcrumbs.Item>{t("confirm")}</Breadcrumbs.Item>}
                  {manual && <Breadcrumbs.Item>{t("manual_entry")}</Breadcrumbs.Item>}
                </>
              )}
            </Breadcrumbs>
            <h3 className="mt-1 text-3xl font-medium text-[#181D20]">
              {editing ? t("edit") : selected ? t("confirm") : manual ? t("manual_entry") : t("search")}
            </h3>
            {editing && (
              <p className="mt-1 font-nunito text-sm text-black/80">{mSymbol}</p>
            )}
            {!editing && !selected && !manual && (
              <p className="mt-1 text-sm text-black/80">
                {t("sec_source")}
              </p>
            )}
            {manual && !editing && (
              <p className="mt-1 max-w-md text-sm text-black/80">
                {t("manual_hint")}
              </p>
            )}
          </div>
          {/* Add-bond art — same position + scale as the holdings card's
              hover-settled cluster. */}
          <div className="pointer-events-none absolute -top-8 right-6 z-0 h-36 w-60" aria-hidden>
            <img src={bondEx2} alt="" className="absolute left-24 top-0 h-6 w-auto" />
            <img src={bondEx1} alt="" className="absolute left-2 top-20 h-12 w-auto" />
            <img src={addBondMain} alt="" className="absolute right-0 top-2 h-28 w-auto" />
          </div>
        </div>

        {!selected && manual && manualReview ? (
          <div className="relative z-10 mt-4 flex min-h-0 flex-1 flex-col rounded-3xl border-[0.5px] border-[#d9d9d9] bg-white p-4">
            {/* Save = folder-head tab above the card, like every other page. */}
            <button
              onClick={saveManual}
              disabled={saving}
              className="absolute bottom-full right-5 z-10 flex items-center gap-2 rounded-t-2xl border-[0.5px] border-b-0 border-[#d9d9d9] bg-white px-4 py-2.5 text-base font-medium text-ink transition hover:bg-[#F0F2F7] disabled:opacity-60"
            >
              {saving ? t("saving") : t("save")}
              <span className="flex size-6 items-center justify-center rounded-full border-[1.5px] border-current text-ink">
                <IconCheck size={14} stroke={2.5} />
              </span>
            </button>
            <p className="text-sm text-black/50">{t("review_before_save")}</p>
            {/* Company profile card — same look as the search→confirm page. */}
            <div className="mt-3 rounded-2xl bg-[#F6F4F1] p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <IssuerLogo
                    symbol={mSymbol.trim().toUpperCase()}
                    name={issuerName(mSymbol, mIssuer)}
                    size={44}
                  />
                  <div className="min-w-0">
                    <p className="font-nunito text-base font-bold text-[#181D20]">
                      {mSymbol.trim().toUpperCase()}
                    </p>
                    <p className="truncate text-xs text-black/60">
                      {issuerName(mSymbol, mIssuer)}
                    </p>
                  </div>
                </div>
                {rating ? (
                  <span className="shrink-0 rounded-lg bg-[#43507F]/10 px-2 py-1 font-nunito text-xs font-bold text-[#43507F]">
                    {rating}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-lg bg-black/5 px-2 py-1 text-xs text-black/40">
                    {t("no_credit_info")}
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-black/60">
                <span>
                  {t("coupon_word")} <b className="font-nunito">{Number.isFinite(mCoupon) ? mCoupon : 0}%</b> {t("per_year")}
                </span>
                <span>{t("pays_interest")} {t(FREQ_KEY[freq as 1 | 2 | 4 | 12] ?? "freq_semi")}</span>
                {manualMaturity && <span>{t("maturity")} {fmtThaiDate(manualMaturity)}</span>}
              </div>
            </div>
            <div className="mt-3 min-h-0 flex-1 divide-y divide-[#F0F0F0] overflow-y-auto">
              {[
                [t("invested_amount"), `฿${(Number.isFinite(amount) ? amount : 0).toLocaleString("th-TH")}`],
                [t("issue_date"), mIssue ? fmtThaiDate(mIssue) : "—"],
                [t("term"), `${Number.isFinite(mTermY) ? mTermY : 0} ${t("year_unit")} ${Number.isFinite(mTermM) ? mTermM : 0} ${t("month_unit")}`],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="text-sm text-black/55">{label}</span>
                  <span className="text-right text-sm font-medium text-[#181D20]">{value}</span>
                </div>
              ))}
            </div>
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
            <div className="mt-3 shrink-0">
              <Button variant="secondary" fullWidth onPress={() => setManualReview(false)}>
                {t("edit")}
              </Button>
            </div>
          </div>
        ) : !selected && manual ? (
          <div className="relative z-10 mt-4 flex min-h-0 flex-1 flex-col gap-3 rounded-3xl border-[0.5px] border-[#d9d9d9] bg-white p-3">
            {/* Save = folder-head tab rising from this card, flush like the
                add-bond tab over the holdings list. */}
            <button
              onClick={goManualReview}
              className="absolute bottom-full right-5 z-10 flex items-center gap-2 rounded-t-2xl border-[0.5px] border-b-0 border-[#d9d9d9] bg-white px-4 py-2.5 text-base font-medium text-ink transition hover:bg-[#F0F2F7]"
            >
              {t("review")}
              <span className="flex size-6 items-center justify-center rounded-full border-[1.5px] border-current text-ink">
                <IconCheck size={14} stroke={2.5} />
              </span>
            </button>
            {/* Fields grouped under collapsible headings. */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Accordion
                allowsMultipleExpanded
                defaultExpandedKeys={["info", "yield", "term"]}
              >
                <Accordion.Item id="info">
                  <Accordion.Heading>
                    <Accordion.Trigger className="flex w-full items-center justify-between py-3 text-base font-medium text-[#181D20]">
                      <span className="flex items-center gap-2">
                        {t("bond_info")}
                        {infoValid && <IconCheck size={18} className="text-[#3FA35B]" stroke={3} />}
                      </span>
                      <Accordion.Indicator><IconChevronDown size={18} /></Accordion.Indicator>
                    </Accordion.Trigger>
                  </Accordion.Heading>
                  <Accordion.Panel>
                    <Accordion.Body className="flex gap-3 pb-4">
                      <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-black/60">
                        {t("symbol_field")} *
                        <Input
                          autoFocus
                          value={mSymbol}
                          onChange={(e) => {
                            const v = e.target.value;
                            setMSymbol(v);
                            // Auto-fill the company from the symbol prefix whenever it
                            // resolves (e.g. ORI284C → Origin) — works for brand-new
                            // series too, since the issuer has other bonds in catalog.
                            const guess = issuerForSymbol(v);
                            if (guess) setMIssuer(guess);
                            // Rating is derived reactively from symbol + company
                            // (see manualRating) — no need to set it here.
                          }}
                          placeholder={t("eg_symbol")}
                          className="font-nunito text-base font-medium uppercase sm:text-base"
                        />
                      </label>
                      <ComboBox
                        aria-label={t("company_name")}
                        allowsCustomValue
                        menuTrigger="input"
                        inputValue={mIssuer}
                        onInputChange={setMIssuer}
                        // Controlled inputValue → react-aria won't auto-set the
                        // field on pick, so sync it here (id === company name).
                        onSelectionChange={(key) => { if (key != null) setMIssuer(String(key)); }}
                        items={issuerMatches}
                        className="flex flex-1 flex-col gap-1"
                      >
                        <Label className="text-sm font-medium text-black/60">{t("company_name")}</Label>
                        <ComboBox.InputGroup className="[&_input]:!font-normal">
                          <Input placeholder={t("eg_company")} className="py-2 text-base !font-normal sm:text-base" />
                          <ComboBox.Trigger />
                        </ComboBox.InputGroup>
                        <ComboBox.Popover>
                          <ListBox items={issuerMatches}>
                            {(it: { id: string; name: string }) => (
                              <ListBox.Item id={it.id} textValue={it.name}>{it.name}</ListBox.Item>
                            )}
                          </ListBox>
                        </ComboBox.Popover>
                      </ComboBox>
                    </Accordion.Body>
                  </Accordion.Panel>
                </Accordion.Item>

                <Accordion.Item id="yield">
                  <Accordion.Heading>
                    <Accordion.Trigger className="flex w-full items-center justify-between py-3 text-base font-medium text-[#181D20]">
                      <span className="flex items-center gap-2">
                        {t("yield_section")}
                        {yieldValid && <IconCheck size={18} className="text-[#3FA35B]" stroke={3} />}
                      </span>
                      <Accordion.Indicator><IconChevronDown size={18} /></Accordion.Indicator>
                    </Accordion.Trigger>
                  </Accordion.Heading>
                  <Accordion.Panel>
                    <Accordion.Body className="flex flex-col gap-3 pb-4">
                      <div className="flex gap-3">
                        <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-black/60">
                          {t("coupon_label")}
                          <NumberField
                            value={mCoupon}
                            onChange={setMCoupon}
                            minValue={0}
                            step={0.1}
                            formatOptions={{ maximumFractionDigits: 2 }}
                            aria-label={t("coupon_label")}
                          >
                            <NumberField.Group>
                              <NumberField.DecrementButton />
                              <NumberField.Input placeholder={t("eg_coupon")} className="text-center font-nunito text-base font-medium" />
                              <NumberField.IncrementButton />
                            </NumberField.Group>
                          </NumberField>
                        </label>
                        <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-black/60">
                          {t("invested_baht")}
                          <NumberField
                            value={amount}
                            onChange={setAmount}
                            minValue={MIN_FACE_VALUE}
                            step={MIN_FACE_VALUE}
                            formatOptions={{ useGrouping: true, maximumFractionDigits: 0 }}
                            aria-label={t("invested_baht")}
                          >
                            <NumberField.Group>
                              <NumberField.DecrementButton />
                              <NumberField.Input placeholder={t("eg_amount")} className="text-center font-nunito text-base font-medium" />
                              <NumberField.IncrementButton />
                            </NumberField.Group>
                          </NumberField>
                        </label>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium text-black/60">{t("pays_interest")}</span>
                        <div className="flex gap-2">
                          {[1, 2, 4, 12].map((f) => {
                            const on = freq === f;
                            return (
                              <button
                                key={f}
                                type="button"
                                onClick={() => setFreq(f)}
                                className={`flex-1 whitespace-nowrap rounded-full border px-2 py-1.5 text-sm font-medium transition ${
                                  on
                                    ? "border-[#43507F] bg-[#43507F] text-white"
                                    : "border-[#d9d9d9] bg-white text-ink hover:bg-[#F0F2F7]"
                                }`}
                              >
                                {t(FREQ_KEY[f as 1 | 2 | 4 | 12])}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </Accordion.Body>
                  </Accordion.Panel>
                </Accordion.Item>

                <Accordion.Item id="term">
                  <Accordion.Heading>
                    <Accordion.Trigger className="flex w-full items-center justify-between py-3 text-base font-medium text-[#181D20]">
                      <span className="flex items-center gap-2">
                        {t("term")}
                        {termValid && <IconCheck size={18} className="text-[#3FA35B]" stroke={3} />}
                      </span>
                      <Accordion.Indicator><IconChevronDown size={18} /></Accordion.Indicator>
                    </Accordion.Trigger>
                  </Accordion.Heading>
                  <Accordion.Panel>
                    <Accordion.Body className="flex gap-3 pb-4">
                      <IssueDatePicker value={mIssue} onChange={setMIssue} />
                      <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-black/60">
                        {t("term")}
                        <div className="flex gap-2">
                          <NumberField
                            value={mTermY}
                            onChange={setMTermY}
                            minValue={0}
                            step={1}
                            formatOptions={{ maximumFractionDigits: 0 }}
                            aria-label={t("term_years")}
                            className="flex-1"
                          >
                            <NumberField.Group className="relative [grid-template-columns:1fr]">
                              <NumberField.Input placeholder={t("year_unit")} className="text-center font-nunito text-base font-medium" />
                              {Number.isFinite(mTermY) && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-black/50">{t("year_unit")}</span>}
                            </NumberField.Group>
                          </NumberField>
                          <NumberField
                            value={mTermM}
                            onChange={setMTermM}
                            minValue={0}
                            maxValue={11}
                            step={1}
                            formatOptions={{ maximumFractionDigits: 0 }}
                            aria-label={t("term_months")}
                            className="flex-1"
                          >
                            <NumberField.Group className="relative [grid-template-columns:1fr]">
                              <NumberField.Input placeholder={t("month_unit")} className="text-center font-nunito text-base font-medium" />
                              {Number.isFinite(mTermM) && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-black/50">{t("month_unit")}</span>}
                            </NumberField.Group>
                          </NumberField>
                        </div>
                      </label>
                    </Accordion.Body>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
              {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
            </div>
            {/* Delete lives at the bottom of the details/edit card. */}
            {editing && onDelete && (
              <div className="mt-2 shrink-0 border-t border-black/5 px-2 pt-3">
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-sm text-black/70">ลบ {mSymbol} ออกจากพอร์ต?</span>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="rounded-2xl border-[0.5px] border-[#d9d9d9] bg-white px-4 py-2.5 text-base font-medium text-ink transition hover:bg-[#F0F2F7]"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={() => onDelete()}
                      className="flex items-center gap-2 rounded-2xl bg-[#D64545] px-4 py-2.5 text-base font-medium text-white transition hover:bg-[#c23c3c]"
                    >
                      ยืนยันลบ
                      <IconTrash size={18} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border-[0.5px] border-[#D64545]/40 px-4 py-2.5 text-base font-medium text-[#D64545] transition hover:bg-[#FBEBEB]"
                  >
                    <IconTrash size={18} />
                    ลบหุ้นกู้นี้
                  </button>
                )}
              </div>
            )}
          </div>
        ) : !selected ? (
          // Search field + results together in one sub-card (like the holdings list).
          <div className="relative z-10 mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border-[0.5px] border-[#d9d9d9] bg-white p-3">
            <SearchField
              value={term}
              onChange={setTerm}
              aria-label={t("search_bond")}
            >
              <SearchField.Group className="h-12">
                <SearchField.SearchIcon />
                <SearchField.Input
                  autoFocus
                  placeholder={t("search_hint")}
                />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>

            <div className="mt-3 min-h-0 flex-1 overflow-hidden">
              <div
                ref={resultsFade.ref}
                onScroll={resultsFade.onScroll}
                style={{ WebkitMaskImage: resultsFade.mask, maskImage: resultsFade.mask }}
                className="h-full overflow-y-auto"
              >
                {/* Realtime empty state — shows the moment the local catalog has
                    no match. */}
                {term.trim().length >= 2 && results.length === 0 && (
                  <div className="flex flex-col items-center gap-3 py-6 text-center">
                    <img src={emptyBonds} alt="" aria-hidden className="h-28 w-auto opacity-90" />
                    <p className="text-sm text-black/40">{t("no_match")} "{term}"</p>
                    {/* Fallback for bonds not yet in the SEC feed. */}
                    <button
                      onClick={() => { setManual(true); setMSymbol(term.trim().toUpperCase()); setError(null); }}
                      className="mt-1 w-full rounded-2xl border border-dashed border-[#43507F]/40 px-3 py-3 text-sm font-medium text-[#43507F] transition-colors hover:bg-[#43507F]/5"
                    >
                      {t("add_own", { term: term.trim() })}
                    </button>
                  </div>
                )}
                <ul className="flex flex-col">
                  {results.map((b, i) => (
                    <li key={b.symbol}>
                      <button
                        onClick={() => {
                          setSelected(b);
                          // Frequency + rating are auto-derived, not user-entered.
                          setFreq(overrideFor(b.symbol)?.frequency ?? b.frequency ?? 2);
                          setRating(ratingFor(b.symbol) ?? "");
                        }}
                        className={`flex w-full items-center justify-between gap-3 py-3 text-left transition-colors hover:bg-[#43507F]/5 ${i < results.length - 1 ? "border-b-[0.5px] border-black/10" : ""}`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <IssuerLogo symbol={b.symbol} name={issuerName(b.symbol, b.issuer)} size={44} />
                          <div className="min-w-0">
                            <p className="font-nunito text-base font-bold text-[#181D20]">{b.symbol}</p>
                            <p className="truncate text-xs text-black/60">{b.nameTh}</p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right text-xs text-black/60">
                          {b.couponRate != null && (
                            <p className="font-nunito text-base font-bold text-[#43507F]">{b.couponRate}%</p>
                          )}
                          {b.maturityDate && <p>{t("maturity")} {fmtThaiDate(b.maturityDate)}</p>}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative z-10 mt-4 flex flex-col gap-4 rounded-3xl border-[0.5px] border-[#d9d9d9] bg-white p-4">
            {/* Add = folder-head tab above the card, like every other page. */}
            <button
              onClick={() => handleSave()}
              disabled={saving}
              className="absolute bottom-full right-5 z-10 flex items-center gap-2 rounded-t-2xl border-[0.5px] border-b-0 border-[#d9d9d9] bg-white px-4 py-2.5 text-base font-medium text-ink transition hover:bg-[#F0F2F7] disabled:opacity-60"
            >
              {saving ? t("saving") : t("add_to_portfolio")}
              <span className="flex size-6 items-center justify-center rounded-full border-[1.5px] border-current text-ink">
                <IconCheck size={14} stroke={2.5} />
              </span>
            </button>
            <div className="rounded-2xl bg-[#F6F4F1] p-4">
              <div className="flex items-start justify-between gap-2">
                {/* Company profile: issuer logo + brand name */}
                <div className="flex min-w-0 items-center gap-3">
                  <IssuerLogo
                    symbol={selected.symbol}
                    name={issuerName(selected.symbol, selected.issuer)}
                    size={44}
                  />
                  <div className="min-w-0">
                    <p className="font-nunito text-base font-bold text-[#181D20]">
                      {selected.symbol}
                    </p>
                    <p className="truncate text-xs text-black/60">
                      {issuerName(selected.symbol, selected.issuer)}
                    </p>
                  </div>
                </div>
                {/* Rating auto-derived — read-only. Shown only when known; an
                    unknown rating is not asserted as "unrated". */}
                {rating ? (
                  <span className="shrink-0 rounded-lg bg-[#43507F]/10 px-2 py-1 font-nunito text-xs font-bold text-[#43507F]">
                    {rating}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-lg bg-black/5 px-2 py-1 text-xs text-black/40">
                    {t("no_credit_info")}
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-black/60">
                {selected.couponRate != null && (
                  <span>
                    {t("coupon_word")} <b className="font-nunito">{selected.couponRate}%</b> {t("per_year")}
                  </span>
                )}
                {/* Frequency auto-parsed from the SEC coupon text / master map. */}
                <span>{t("pays_interest")} {t(FREQ_KEY[freq as 1 | 2 | 4 | 12] ?? "freq_semi")}</span>
                {selected.maturityDate && <span>{t("maturity")} {selected.maturityDate}</span>}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-black/60">{t("investment_baht")}</Label>

              {/* Quick-pick presets */}
              <div className="flex gap-2">
                {AMOUNT_PRESETS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAmount(v)}
                    className={`flex-1 whitespace-nowrap rounded-full border px-3 py-1 font-nunito text-xs transition-colors ${
                      amount === v
                        ? "border-[#43507F] bg-[#43507F]/10 font-bold text-[#43507F]"
                        : "border-[#E7E7E7] text-black/60 hover:border-[#43507F]/40"
                    }`}
                  >
                    {v.toLocaleString("th-TH")}
                  </button>
                ))}
              </div>

              {/* Stepper — step 100,000, min 100,000 */}
              <NumberField
                value={amount}
                onChange={setAmount}
                minValue={MIN_FACE_VALUE}
                step={MIN_FACE_VALUE}
                formatOptions={{ useGrouping: true, maximumFractionDigits: 0 }}
                aria-label={t("investment_baht")}
              >
                <NumberField.Group>
                  <NumberField.DecrementButton />
                  <NumberField.Input autoFocus placeholder={t("eg_amount")} className="text-center font-nunito text-base font-medium" />
                  <NumberField.IncrementButton />
                </NumberField.Group>
              </NumberField>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        )}
    </>
  );

  // Inline mode: fill the host panel, no Modal chrome.
  if (inline) {
    if (!open) return null;
    return <div className="relative flex h-full w-full flex-col">{body}</div>;
  }

  return (
    <Modal isOpen={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <ModalBackdrop isDismissable>
        <ModalContainer placement="center">
          <ModalDialog className="relative flex h-140 w-full max-w-lg flex-col rounded-3xl bg-white p-6">
            {body}
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
}
