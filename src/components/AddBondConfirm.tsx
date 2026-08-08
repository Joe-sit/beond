import { useEffect, useMemo, useState } from "react";
import { IconChevronLeft, IconChevronDown, IconMinus, IconPlus, IconSearch, IconCalendar } from "@tabler/icons-react";
import { ComboBox, ListBox, Input, Label, DatePicker, Calendar } from "@heroui/react";
import { Group, DateInput, DateSegment, Dialog, I18nProvider } from "react-aria-components";
import { parseDate, toCalendar, GregorianCalendar, type DateValue } from "@internationalized/date";
import { animate, motion, AnimatePresence, useMotionValue, useTransform } from "motion/react";
import { fetchBondDetail, issuerNames, type BondCandidate, type BondDetail } from "../lib/secApi";
import { deriveCouponSchedule, parseFrequency } from "../lib/couponSchedule";
import { overrideFor } from "../data/couponOverrides";
import { ratingFor } from "../data/bondRatings";
import { issuerName } from "../lib/issuerLogo";
import IssuerLogo from "./IssuerLogo";
import { useT } from "../lib/i18n";
import addingBond from "../assets/badges/adding-bond.svg";
import unknownBond from "../assets/badges/unknown-bond.svg";

const THAI_MONTHS_ABBR = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];
function fmtThaiDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${THAI_MONTHS_ABBR[d.getMonth()]} ${d.getFullYear() + 543}`;
}
function fmtTerm(y: number | null, m: number | null, d: number | null): string {
  let years = y;
  let months = m;
  // ThaiBMA gives the term as a fractional year (e.g. 1.7534) with no separate
  // month field — split the fraction into whole years + months.
  if (y != null && m == null && !Number.isInteger(y)) {
    years = Math.floor(y);
    months = Math.round((y - years) * 12);
    if (months === 12) { years += 1; months = 0; }
  }
  const parts = [years ? `${years} ปี` : "", months ? `${months} เดือน` : "", d ? `${d} วัน` : ""].filter(Boolean);
  return parts.length ? parts.join(" ") : "—";
}
// Coupon-frequency (payments/year) → Thai label.
const FREQ_LABEL: Record<number, string> = {
  1: "ปีละครั้ง",
  2: "ทุก 6 เดือน",
  4: "ทุก 3 เดือน",
  12: "ทุกเดือน",
};

// A manual bond with no company resolved yet — shown as a "?" placeholder.
const isUnknown = (c: BondCandidate) => c.source === "manual" && !c.issuer.trim();

// Count-up a baht amount so it rolls on +/- instead of snapping.
export function AnimatedBaht({ value }: { value: number }) {
  const safe = Number.isFinite(value) ? value : 0;
  const mv = useMotionValue(safe);
  const text = useTransform(mv, (v) => `฿${Math.round(v).toLocaleString("th-TH")}`);
  useEffect(() => {
    const controls = animate(mv, safe, { duration: 0.4, ease: [0.22, 1, 0.36, 1] });
    return controls.stop;
  }, [safe, mv]);
  return <motion.span>{text}</motion.span>;
}

export interface ConfirmItem {
  cand: BondCandidate;
  amount: number;
  freq: number;
  rating: string;
}

interface Props {
  items: ConfirmItem[];
  minFaceValue: number;
  saving: boolean;
  error: string | null;
  onChangeAmount: (symbol: string, amount: number) => void;
  onChangeField: (symbol: string, patch: Partial<BondCandidate>) => void;
  onBack: () => void;
  onSave: () => void;
}

// Step 2 of the add-bond flow (Figma 1138:3640). Left: an accordion to enter
// each bond's face value. Right: a tabbed detail panel (details / slip history)
// with a coupon-schedule bar chart for the currently-open bond.
export default function AddBondConfirm({
  items,
  minFaceValue,
  saving,
  error,
  onChangeAmount,
  onChangeField,
  onBack,
  onSave,
}: Props) {
  const t = useT();
  const [openSym, setOpenSym] = useState<string | null>(items[0]?.cand.symbol ?? null);

  // Keep an open row valid as the cart changes.
  useEffect(() => {
    if (!items.some((it) => it.cand.symbol === openSym)) {
      setOpenSym(items[0]?.cand.symbol ?? null);
    }
  }, [items, openSym]);

  const active = items.find((it) => it.cand.symbol === openSym) ?? items[0] ?? null;

  return (
    <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,537px)_minmax(0,1fr)]">
      {/* LEFT — accordion form + save */}
      <div className="flex min-h-0 flex-col gap-4">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border-[0.5px] border-black/10 bg-white">
          <div className="p-6 pb-0">
            <button
              type="button"
              onClick={onBack}
              className="flex w-fit items-center gap-1.5 rounded-full border-[0.5px] border-black/10 bg-[#f5f5f5] px-3 py-2 text-sm font-medium text-[#222] transition hover:bg-black/5"
            >
              <IconChevronLeft size={18} /> {t("back")}
            </button>
          </div>
          {/* Header */}
          <div className="flex items-start justify-between gap-4 p-6">
            <div className="min-w-0">
              <p className="text-base font-medium text-black">{t("confirm_title")}</p>
              <p className="mt-1 text-sm text-black/60">{t("confirm_sub")}</p>
            </div>
            <img src={addingBond} alt="" aria-hidden className="h-16 w-auto shrink-0" />
          </div>

          {/* Accordion list */}
          <div className="flex min-h-0 flex-1 flex-col divide-y divide-black/10 overflow-y-auto border-t-[0.5px] border-black/10">
            {items.map((it) => {
              const open = it.cand.symbol === openSym;
              const unknown = isUnknown(it.cand);
              const manual = it.cand.source === "manual"; // needs its details typed in
              const name = unknown ? t("no_company_yet") : issuerName(it.cand.symbol, it.cand.issuer);
              return (
                <div key={it.cand.symbol} className="flex flex-col p-4">
                  <div className="flex items-center gap-4">
                    {unknown ? (
                      <div className="flex size-16 shrink-0 items-center justify-center rounded-full border border-black/10">
                        <img src={unknownBond} alt="" className="h-10 w-auto" />
                      </div>
                    ) : (
                      <IssuerLogo symbol={it.cand.symbol} name={name} size={64} className="rounded-full!" />
                    )}
                    <button
                      type="button"
                      onClick={() => setOpenSym(open ? null : it.cand.symbol)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-medium text-black">{it.cand.symbol}</p>
                        <p className="truncate text-sm text-black/60">{name}</p>
                      </div>
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-black/10 text-black/60">
                        <IconChevronDown size={22} className={`transition ${open ? "rotate-180" : ""}`} />
                      </span>
                    </button>
                  </div>

                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        key="amt"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{
                          height: { type: "spring", stiffness: 400, damping: 40, mass: 0.8 },
                          opacity: { duration: 0.2, ease: "easeOut" },
                        }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 flex flex-col gap-4">
                          <div className="flex items-center justify-between gap-3 rounded-3xl bg-[rgba(30,125,235,0.05)] p-4">
                            <div className="min-w-0">
                              <p className="text-base text-black/60">{t("invested_value")}</p>
                              <p className="mt-1 font-nunito text-2xl font-medium text-black">
                                <AnimatedBaht value={it.amount} />
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              <motion.button
                                type="button"
                                aria-label="-"
                                disabled={!Number.isFinite(it.amount) || it.amount <= minFaceValue}
                                onClick={() => onChangeAmount(it.cand.symbol, Math.max(minFaceValue, (it.amount || minFaceValue) - minFaceValue))}
                                whileTap={{ scale: 0.95 }}
                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                className="flex size-12 items-center justify-center rounded-full bg-brand-blue text-white hover:bg-[#215688] disabled:opacity-40"
                              >
                                <IconMinus size={24} />
                              </motion.button>
                              <motion.button
                                type="button"
                                aria-label="+"
                                onClick={() => onChangeAmount(it.cand.symbol, (Number.isFinite(it.amount) ? it.amount : 0) + minFaceValue)}
                                whileTap={{ scale: 0.95 }}
                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                className="flex size-12 items-center justify-center rounded-full bg-brand-blue text-white hover:bg-[#215688]"
                              >
                                <IconPlus size={24} />
                              </motion.button>
                            </div>
                          </div>

                          {/* Manual (not-in-SEC) bonds: fill in the missing details */}
                          {manual && (
                            <>
                              <div className="flex flex-col gap-2 rounded-3xl bg-[rgba(30,125,235,0.05)] p-2">
                                <CompanyCombo
                                  value={it.cand.issuer}
                                  onChange={(v) => onChangeField(it.cand.symbol, { issuer: v })}
                                />
                              </div>

                              <div className="flex gap-4">
                                {/* Issue date — white card + ThaiBMA auto-fill note (Figma 1274:3608) */}
                                <div className="flex flex-1 flex-col items-center gap-2 rounded-3xl bg-[rgba(30,125,235,0.05)] p-2">
                                  <IssueDatePicker
                                    value={it.cand.issueDate ?? ""}
                                    onChange={(iso) => onChangeField(it.cand.symbol, { issueDate: iso || null })}
                                  />
                                  {it.cand.issueDate && (
                                    <p className="text-xs text-[#222]">{t("thaibma_autofilled")}</p>
                                  )}
                                </div>
                                {/* Coupon rate — white card + % suffix */}
                                <div className="flex flex-1 flex-col items-center gap-2 rounded-3xl bg-[rgba(30,125,235,0.05)] p-2">
                                  <div className="flex w-full items-center justify-between gap-2 rounded-3xl bg-white p-4">
                                    <div className="flex min-w-0 flex-1 flex-col">
                                      <span className="text-xs text-[#222]">{t("coupon_rate")}</span>
                                      <input
                                        type="number"
                                        inputMode="decimal"
                                        step="0.1"
                                        value={it.cand.couponRate ?? ""}
                                        onChange={(e) => onChangeField(it.cand.symbol, { couponRate: e.target.value === "" ? null : Number(e.target.value) })}
                                        placeholder="0.00"
                                        className="min-w-0 bg-transparent font-nunito text-base font-medium text-[#222] outline-none"
                                      />
                                    </div>
                                    <span className="shrink-0 text-xs font-medium text-[#222]/60">%</span>
                                  </div>
                                  {it.cand.couponRate != null && (
                                    <p className="text-xs text-[#222]">{t("thaibma_autofilled")}</p>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>

        <div className="shrink-0">
          {error && <p className="pb-2 text-sm text-red-500">{error}</p>}
          <button
            onClick={onSave}
            disabled={saving}
            className="flex w-full items-center justify-center rounded-full bg-brand-blue py-4 text-xl font-medium text-white transition hover:bg-[#215688] disabled:opacity-60"
          >
            {saving ? t("saving") : t("save")}
          </button>
        </div>
      </div>

      {/* RIGHT — bond detail */}
      <div className="flex min-h-0 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto rounded-3xl bg-white p-6">
          {active && <DetailPanel cand={active.cand} />}
        </div>
      </div>
    </div>
  );
}

// Right-tab detail: bond attributes + a coupon-schedule bar chart (per ฿100k).
// Exported so the port-side edit view (AddBondModal) can reuse the exact same
// detail layout as this confirm page.
export function DetailPanel({ cand }: { cand: BondCandidate }) {
  const t = useT();
  const [detail, setDetail] = useState<BondDetail | null>(null);

  useEffect(() => {
    setDetail(null);
    const ac = new AbortController();
    fetchBondDetail(cand.symbol, ac.signal).then(setDetail);
    return () => ac.abort();
  }, [cand.symbol]);

  const unknown = isUnknown(cand);
  const name = unknown ? t("no_company_yet") : issuerName(cand.symbol, cand.issuer);
  const rating = ratingFor(cand.symbol);
  const couponRate = detail?.couponRate ?? cand.couponRate ?? null;
  const freq =
    overrideFor(cand.symbol)?.frequency ??
    cand.frequency ??
    parseFrequency(detail?.couponDesc ?? detail?.couponName) ??
    2;

  const schedule = useMemo(
    () =>
      deriveCouponSchedule({
        issueDate: detail?.issueDate ?? cand.issueDate,
        maturityDate: detail?.maturityDate ?? cand.maturityDate,
        termYears: detail?.termYears ?? cand.termYears,
        frequency: freq,
        couponRate,
        faceValue: 100_000,
      }),
    [detail, cand, freq, couponRate],
  );

  const rows: [string, React.ReactNode][] = [
    [t("company_name"), name],
    [t("coupon_rate"), couponRate != null ? `${couponRate}%` : detail?.couponRateText ?? "—"],
    [t("pays_interest"), FREQ_LABEL[freq] ?? "—"],
    [t("rating"), rating || "—"],
    [t("redeem_term"), fmtTerm(detail?.termYears ?? cand.termYears ?? null, detail?.termMonth ?? null, detail?.termDay ?? null)],
    [t("issue_date"), fmtThaiDate(detail?.issueDate ?? cand.issueDate)],
    [t("maturity"), fmtThaiDate(detail?.maturityDate ?? cand.maturityDate)],
    [t("secured_kind"), detail?.secured ?? "—"],
    ["ISIN", <span className="font-nunito">{detail?.isin || cand.isin || "—"}</span>],
  ];

  const maxAmt = Math.max(1, ...schedule.map((p) => p.amount));
  // Round the axis top up to a clean step so bars have headroom and the near-
  // equal coupons read against gridlines instead of all clamping to the top.
  const axisTop = Math.max(500, Math.ceil(maxAmt / 500) * 500);
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((f) => Math.round(axisTop * f));

  return (
    <>
      <div className="flex items-start gap-4">
        {unknown ? (
          <div className="flex size-30 shrink-0 items-center justify-center rounded-[2.5rem] border border-black/10">
            <img src={unknownBond} alt="" className="h-16 w-auto" />
          </div>
        ) : (
          <IssuerLogo symbol={cand.symbol} name={name} size={120} className="rounded-[2.5rem]!" />
        )}
        <div className="min-w-0 flex-1">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center gap-6 border-b border-black/10 py-3">
              <span className="w-40 shrink-0 whitespace-nowrap text-base text-black/60">{label}</span>
              <span className="min-w-0 text-base text-black">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Coupon-schedule bar chart (per ฿100,000). */}
      <div className="rounded-3xl bg-[#f3f3f3] p-6">
        <p className="mb-4 text-base font-medium text-black">
          {t("interest_dates")} <span className="text-black/50">({t("per")} ฿100,000)</span>
        </p>
        {schedule.length === 0 ? (
          <p className="py-8 text-center text-sm text-black/40">—</p>
        ) : (
          <div className="flex gap-3">
            {/* Y-axis ticks */}
            <div className="flex h-40 shrink-0 flex-col justify-between text-right font-nunito text-[10px] text-black/40">
              {ticks.map((v) => (
                <span key={v} className="leading-none">{v.toLocaleString("th-TH")}</span>
              ))}
            </div>
            {/* Plot area */}
            <div className="min-w-0 flex-1 overflow-x-auto">
              <div className="relative h-40">
                {/* gridlines */}
                {ticks.map((v, i) => (
                  <div
                    key={v}
                    className="absolute inset-x-0 border-t border-black/10"
                    style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
                  />
                ))}
                {/* bars */}
                <div className="absolute inset-0 flex items-end gap-2">
                  {schedule.map((p) => (
                    <div
                      key={p.installment}
                      title={`${p.amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`}
                      className="min-w-10 flex-1 rounded-t-lg bg-brand-blue/70 transition hover:bg-brand-blue"
                      style={{ height: `${(p.amount / axisTop) * 100}%` }}
                    />
                  ))}
                </div>
              </div>
              {/* X-axis labels */}
              <div className="mt-2 flex gap-2">
                {schedule.map((p) => (
                  <span key={p.installment} className="min-w-10 flex-1 text-center font-nunito text-[10px] text-black/40">
                    {new Date(p.date).getMonth() + 1}/{(new Date(p.date).getFullYear() + 543) % 100}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// Company-name combobox backed by the SEC catalog's issuer list — type to
// filter, pick from the popover, or keep a custom name. Same behaviour as the
// manual-entry issuer field.
export function CompanyCombo({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useT();
  const [q, setQ] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setQ(value.trim().toLowerCase()), 200);
    return () => clearTimeout(id);
  }, [value]);
  const matches = useMemo(() => {
    const all = issuerNames();
    const list = q ? all.filter((n) => n.toLowerCase().includes(q)) : all;
    return list.slice(0, 50).map((n) => ({ id: n, name: n }));
  }, [q]);
  return (
    <ComboBox
      aria-label={t("company_name")}
      allowsCustomValue
      menuTrigger="focus"
      inputValue={value}
      onInputChange={onChange}
      onSelectionChange={(key) => { if (key != null) onChange(String(key)); }}
      items={matches}
    >
      {/* White card: stacked label + value, search icon right (Figma 1279:3801).
          Whole card is the click target (focuses the input) and heroUI's focus
          ring is suppressed. */}
      <ComboBox.InputGroup
        onPointerDown={(e) => {
          const input = (e.currentTarget as HTMLElement).querySelector("input");
          if (input && e.target !== input) { e.preventDefault(); input.focus(); }
        }}
        className="h-auto w-full cursor-pointer items-center gap-2 rounded-3xl border-0 bg-white p-4 shadow-none outline-none ring-0 focus-within:ring-0 data-[focused]:ring-0 data-[focus-visible]:ring-0"
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <Label className="cursor-pointer text-xs text-[#222]">{t("company_name")}</Label>
          <Input
            placeholder={t("company_placeholder")}
            className="cursor-pointer border-0 bg-transparent p-0 font-normal! text-base text-[#222] shadow-none outline-none ring-0 placeholder:text-[#222]/30 focus:ring-0"
          />
        </div>
        <ComboBox.Trigger className="mr-2 shrink-0 text-[#222] outline-none ring-0">
          <IconSearch size={24} />
        </ComboBox.Trigger>
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox items={matches}>
          {(it: { id: string; name: string }) => (
            <ListBox.Item id={it.id} textValue={it.name}>{it.name}</ListBox.Item>
          )}
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  );
}

// heroUI DatePicker for the manual issue-date field — Thai/Buddhist-era locale,
// converting back to a Gregorian ISO string. Exported so the port edit view can
// reuse the exact same white-card field.
export function IssueDatePicker({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const t = useT();
  let dv: DateValue | null = null;
  try { dv = value ? parseDate(value) : null; } catch { dv = null; }
  return (
    <I18nProvider locale="th-TH-u-ca-buddhist">
      <DatePicker
        aria-label={t("issue_date_bond")}
        value={dv}
        onChange={(v) => onChange(v ? toCalendar(v, new GregorianCalendar()).toString() : "")}
        className="w-full"
      >
        {/* White card: stacked label + value on the left, calendar icon right;
            the whole card opens the calendar (Figma 1274:3608). */}
        <Group className="relative flex w-full cursor-pointer items-center justify-between gap-2 rounded-3xl bg-white p-4">
          <DatePicker.Trigger className="absolute inset-0 z-0" aria-label={t("open_calendar")}>
            <span className="sr-only">{t("open_calendar")}</span>
          </DatePicker.Trigger>
          <div className="pointer-events-none flex min-w-0 flex-1 flex-col">
            <Label className="text-xs text-[#222]">{t("issue_date_bond")}</Label>
            <DateInput className="flex font-nunito text-base font-medium text-[#222]">
              {(segment) => (
                <DateSegment
                  segment={segment}
                  className="rounded px-0.5 tabular-nums outline-none data-[placeholder]:text-[#222]/30"
                />
              )}
            </DateInput>
          </div>
          <IconCalendar size={24} className="pointer-events-none relative z-10 shrink-0 text-[#222]" />
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

