import { useEffect, useRef, useState } from "react";
import {
  Modal, ModalBackdrop, ModalContainer, ModalDialog,
  Breadcrumbs, Button, SearchField, Label, NumberField, Accordion, toast,
} from "@heroui/react";
import { ensureCatalog, searchBonds, issuerNames, issuerForSymbol, type BondCandidate } from "../lib/secApi";
import { deriveCouponSchedule } from "../lib/couponSchedule";
import { overrideFor } from "../data/couponOverrides";
import { ratingFor } from "../data/bondRatings";
import { notifyPortfolioChanged } from "../hooks/usePortfolio";
import { supabase, supabaseEnabled } from "../lib/supabase";
import IssuerLogo from "./IssuerLogo";
import { issuerName } from "../lib/issuerLogo";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import emptyBonds from "../assets/empty-bonds.svg";
import addBondMain from "../assets/add-bond-main.png";
import bondEx1 from "../assets/bond-ex-1.png";
import bondEx2 from "../assets/bond-ex-2.png";

interface AddBondModalProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  initialTerm?: string; // prefill the search (e.g. a bond code OCR'd from a slip)
  inline?: boolean; // render the body in place (no Modal chrome), filling its parent
}

// SEC doesn't classify bonds by industry, and the form no longer asks — new
// bonds land in the "unclassified" sector (migration 0015).
const FALLBACK_SECTOR_ID = "other";

// Minimum face value a holding can be added with, and the counter's step.
const MIN_FACE_VALUE = 100_000;
const AMOUNT_PRESETS = [100_000, 500_000, 1_000_000];

const FREQ_LABEL: Record<number, string> = {
  1: "ปีละครั้ง",
  2: "ทุก 6 เดือน",
  4: "ทุกไตรมาส",
  12: "ทุกเดือน",
};

function ResultSkeleton() {
  return (
    <ul className="flex animate-pulse flex-col gap-2">
      {Array.from({ length: 4 }, (_, i) => (
        <li
          key={i}
          className="flex items-center justify-between gap-3 rounded-2xl border border-[#E7E7E7] p-3"
        >
          <div className="flex flex-col gap-2">
            <span className="h-3.5 w-24 rounded bg-gray-200" />
            <span className="h-3 w-48 rounded bg-gray-100" />
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="h-3.5 w-10 rounded bg-gray-200" />
            <span className="h-3 w-28 rounded bg-gray-100" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function AddBondModal({ open, onClose, onAdded, initialTerm, inline = false }: AddBondModalProps) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<BondCandidate[]>([]);
  const [searching, setSearching] = useState(false);
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

  const abortRef = useRef<AbortController | null>(null);

  // Warm the full bond catalog as soon as the modal opens, so free-text
  // searches (company names) answer locally and instantly.
  useEffect(() => {
    if (open) {
      ensureCatalog();
      if (initialTerm) setTerm(initialTerm); // prefill from an OCR'd bond code
    }
  }, [open, initialTerm]);

  // Debounced search; stale in-flight requests are aborted.
  useEffect(() => {
    if (!open || selected) return;
    if (term.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    const t = setTimeout(() => {
      searchBonds(term, controller.signal)
        .then((r) => {
          if (!controller.signal.aborted) setResults(r);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
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
  };

  // Build a candidate from the manual form fields.
  const buildManualCandidate = (): BondCandidate | null => {
    const sym = mSymbol.trim().toUpperCase();
    if (!sym) { setError("กรอกชื่อรุ่นหุ้นกู้"); return null; }
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

  // Manual flow saves straight from the header button (no confirm step).
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
      if (!publicUserId) throw new Error("ไม่พบผู้ใช้ กรุณาเข้าสู่ระบบใหม่");

      // Real coupon schedule derived from the bond's attributes.
      const schedule = deriveCouponSchedule({
        issueDate: cand.issueDate,
        maturityDate: cand.maturityDate,
        termYears: cand.termYears,
        frequency: freq, // user-picked; SEC omits payment frequency
        couponRate: cand.couponRate,
        faceValue,
      });

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
      toast.success(`เพิ่ม ${cand.symbol} เข้าพอร์ตแล้ว`);
      handleClose();
      onAdded();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง";
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
              <Breadcrumbs.Item onPress={handleClose}>เพิ่มหุ้นกู้</Breadcrumbs.Item>
              <Breadcrumbs.Item onPress={() => { setSelected(null); setManual(false); setError(null); }}>ค้นหา</Breadcrumbs.Item>
              {selected && <Breadcrumbs.Item>ยืนยัน</Breadcrumbs.Item>}
              {manual && <Breadcrumbs.Item>กรอกเอง</Breadcrumbs.Item>}
            </Breadcrumbs>
            <h3 className="mt-1 text-3xl font-medium text-[#181D20]">
              {selected ? "ยืนยัน" : manual ? "กรอกเอง" : "ค้นหา"}
            </h3>
            {!selected && !manual && (
              <p className="mt-1 text-sm text-black/80">
                ข้อมูลตราสารหนี้จาก SEC Open Data API (ก.ล.ต.)
              </p>
            )}
            {manual && (
              <p className="mt-1 max-w-md text-sm text-black/80">
                สำหรับหุ้นกู้ที่ยังไม่มีในระบบ SEC
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

        {!selected && manual ? (
          <div className="relative z-10 mt-4 flex min-h-0 flex-1 flex-col gap-3 rounded-3xl border-[0.5px] border-[#d9d9d9] bg-white p-4">
            {/* Save = folder-head tab rising from this card, flush like the
                add-bond tab over the holdings list. */}
            <button
              onClick={saveManual}
              disabled={saving}
              className="absolute bottom-full right-5 z-10 flex items-center gap-2 rounded-t-2xl border-[0.5px] border-b-0 border-[#d9d9d9] bg-white px-4 py-2.5 text-base font-medium text-ink transition hover:bg-[#F0F2F7] disabled:opacity-60"
            >
              {saving ? "กำลังบันทึก..." : "บันทึก"}
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
                        ข้อมูลหุ้นกู้
                        {infoValid && <IconCheck size={18} className="text-[#3FA35B]" stroke={3} />}
                      </span>
                      <Accordion.Indicator><IconChevronDown size={18} /></Accordion.Indicator>
                    </Accordion.Trigger>
                  </Accordion.Heading>
                  <Accordion.Panel>
                    <Accordion.Body className="flex gap-3 pb-4">
                      <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-black/60">
                        ชื่อรุ่น *
                        <input
                          autoFocus
                          value={mSymbol}
                          onChange={(e) => {
                            const v = e.target.value;
                            setMSymbol(v);
                            // Auto-fill the issuer from the symbol prefix while it's blank.
                            if (!mIssuer.trim()) {
                              const guess = issuerForSymbol(v);
                              if (guess) setMIssuer(guess);
                            }
                          }}
                          placeholder="เช่น ORI284C"
                          className="rounded-xl border border-[#E7E7E7] px-3 py-2 font-nunito text-base font-medium uppercase text-[#181D20] outline-none focus:border-[#43507F]"
                        />
                      </label>
                      <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-black/60">
                        ชื่อบริษัท
                        <input
                          list="issuer-suggestions"
                          value={mIssuer}
                          onChange={(e) => setMIssuer(e.target.value)}
                          placeholder="เช่น ออริจิ้น พร็อพเพอร์ตี้"
                          className="rounded-xl border border-[#E7E7E7] px-3 py-2 text-base text-[#181D20] outline-none focus:border-[#43507F]"
                        />
                        <datalist id="issuer-suggestions">
                          {issuerNames().map((n) => (
                            <option key={n} value={n} />
                          ))}
                        </datalist>
                      </label>
                    </Accordion.Body>
                  </Accordion.Panel>
                </Accordion.Item>

                <Accordion.Item id="yield">
                  <Accordion.Heading>
                    <Accordion.Trigger className="flex w-full items-center justify-between py-3 text-base font-medium text-[#181D20]">
                      <span className="flex items-center gap-2">
                        ผลตอบแทน
                        {yieldValid && <IconCheck size={18} className="text-[#3FA35B]" stroke={3} />}
                      </span>
                      <Accordion.Indicator><IconChevronDown size={18} /></Accordion.Indicator>
                    </Accordion.Trigger>
                  </Accordion.Heading>
                  <Accordion.Panel>
                    <Accordion.Body className="flex flex-col gap-3 pb-4">
                      <div className="flex gap-3">
                        <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-black/60">
                          ดอกเบี้ย (% ต่อปี)
                          <NumberField
                            value={mCoupon}
                            onChange={setMCoupon}
                            minValue={0}
                            step={0.1}
                            formatOptions={{ maximumFractionDigits: 2 }}
                            aria-label="ดอกเบี้ย (% ต่อปี)"
                          >
                            <NumberField.Group>
                              <NumberField.DecrementButton />
                              <NumberField.Input placeholder="เช่น 5.5" className="text-center font-nunito" />
                              <NumberField.IncrementButton />
                            </NumberField.Group>
                          </NumberField>
                        </label>
                        <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-black/60">
                          มูลค่าที่ลงทุน (บาท)
                          <NumberField
                            value={amount}
                            onChange={setAmount}
                            minValue={MIN_FACE_VALUE}
                            step={MIN_FACE_VALUE}
                            formatOptions={{ useGrouping: true, maximumFractionDigits: 0 }}
                            aria-label="มูลค่าที่ลงทุน (บาท)"
                          >
                            <NumberField.Group>
                              <NumberField.DecrementButton />
                              <NumberField.Input placeholder="เช่น 100,000" className="text-center font-nunito" />
                              <NumberField.IncrementButton />
                            </NumberField.Group>
                          </NumberField>
                        </label>
                      </div>
                      <label className="flex flex-col gap-1 text-sm font-medium text-black/60">
                        จ่ายดอกเบี้ย
                        <select
                          value={freq}
                          onChange={(e) => setFreq(Number(e.target.value))}
                          className="rounded-xl border border-[#E7E7E7] px-3 py-2 text-base text-[#181D20] outline-none focus:border-[#43507F]"
                        >
                          {[1, 2, 4, 12].map((f) => (
                            <option key={f} value={f}>{FREQ_LABEL[f]}</option>
                          ))}
                        </select>
                      </label>
                    </Accordion.Body>
                  </Accordion.Panel>
                </Accordion.Item>

                <Accordion.Item id="term">
                  <Accordion.Heading>
                    <Accordion.Trigger className="flex w-full items-center justify-between py-3 text-base font-medium text-[#181D20]">
                      <span className="flex items-center gap-2">
                        อายุหุ้นกู้
                        {termValid && <IconCheck size={18} className="text-[#3FA35B]" stroke={3} />}
                      </span>
                      <Accordion.Indicator><IconChevronDown size={18} /></Accordion.Indicator>
                    </Accordion.Trigger>
                  </Accordion.Heading>
                  <Accordion.Panel>
                    <Accordion.Body className="flex gap-3 pb-4">
                      <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-black/60">
                        วันที่ออก
                        <input
                          type="date"
                          value={mIssue}
                          onChange={(e) => setMIssue(e.target.value)}
                          className="rounded-xl border border-[#E7E7E7] px-3 py-2 text-base text-[#181D20] outline-none focus:border-[#43507F]"
                        />
                      </label>
                      <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-black/60">
                        อายุหุ้นกู้
                        <div className="flex gap-2">
                          <NumberField
                            value={mTermY}
                            onChange={setMTermY}
                            minValue={0}
                            step={1}
                            formatOptions={{ maximumFractionDigits: 0 }}
                            aria-label="อายุหุ้นกู้ (ปี)"
                          >
                            <NumberField.Group>
                              <NumberField.Input placeholder="ปี" className="text-center font-nunito" />
                            </NumberField.Group>
                          </NumberField>
                          <NumberField
                            value={mTermM}
                            onChange={setMTermM}
                            minValue={0}
                            maxValue={11}
                            step={1}
                            formatOptions={{ maximumFractionDigits: 0 }}
                            aria-label="อายุหุ้นกู้ (เดือน)"
                          >
                            <NumberField.Group>
                              <NumberField.Input placeholder="เดือน" className="text-center font-nunito" />
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
          </div>
        ) : !selected ? (
          // Search field + results together in one sub-card (like the holdings list).
          <div className="relative z-10 mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border-[0.5px] border-[#d9d9d9] bg-white p-4">
            <SearchField
              value={term}
              onChange={setTerm}
              aria-label="ค้นหาหุ้นกู้"
            >
              <SearchField.Group className="h-12">
                <SearchField.SearchIcon />
                <SearchField.Input
                  autoFocus
                  placeholder="พิมพ์รหัสหุ้นกู้ / ชื่อบริษัท เช่น ORI288B, PTT298A, CPALL285A"
                />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>

            <div className="mt-3 min-h-0 flex-1 overflow-hidden">
              <div className="h-full overflow-y-auto">
                {searching && results.length === 0 && <ResultSkeleton />}
                {!searching && term.trim().length >= 2 && results.length === 0 && (
                  <div className="flex flex-col items-center gap-3 py-6 text-center">
                    <img src={emptyBonds} alt="" aria-hidden className="h-28 w-auto opacity-90" />
                    <p className="text-sm text-black/40">ไม่พบหุ้นกู้ที่ตรงกับ "{term}"</p>
                    {/* Fallback for bonds not yet in the SEC feed. */}
                    <button
                      onClick={() => { setManual(true); setMSymbol(term.trim().toUpperCase()); setError(null); }}
                      className="mt-1 w-full rounded-2xl border border-dashed border-[#43507F]/40 px-3 py-3 text-sm font-medium text-[#43507F] transition-colors hover:bg-[#43507F]/5"
                    >
                      เพิ่ม "{term.trim()}" เอง
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
                          {b.maturityDate && <p>ครบกำหนด {b.maturityDate}</p>}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative z-10 mt-4 flex flex-col gap-4">
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
                    ไม่มีข้อมูลเครดิต
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-black/60">
                {selected.couponRate != null && (
                  <span>
                    ดอกเบี้ย <b className="font-nunito">{selected.couponRate}%</b> ต่อปี
                  </span>
                )}
                {/* Frequency auto-parsed from the SEC coupon text / master map. */}
                <span>จ่ายดอกเบี้ย {FREQ_LABEL[freq] ?? "ทุก 6 เดือน"}</span>
                {selected.maturityDate && <span>ครบกำหนด {selected.maturityDate}</span>}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-black/60">จำนวนเงินลงทุน (บาท)</Label>

              {/* Quick-pick presets */}
              <div className="flex flex-wrap gap-2">
                {AMOUNT_PRESETS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAmount(v)}
                    className={`rounded-full border px-3 py-1 font-nunito text-xs transition-colors ${
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
                aria-label="จำนวนเงินลงทุน (บาท)"
              >
                <NumberField.Group>
                  <NumberField.DecrementButton />
                  <NumberField.Input autoFocus placeholder="เช่น 100,000" className="text-center font-nunito" />
                  <NumberField.IncrementButton />
                </NumberField.Group>
              </NumberField>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onPress={() => setSelected(null)}>
                ย้อนกลับ
              </Button>
              <Button variant="primary" fullWidth isDisabled={saving} onPress={() => handleSave()}>
                {saving ? "กำลังบันทึก..." : "เพิ่มเข้าพอร์ต"}
              </Button>
            </div>
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
