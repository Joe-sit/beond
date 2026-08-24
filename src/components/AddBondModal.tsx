import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Modal, ModalBackdrop, ModalContainer, ModalDialog,
  Button, SearchField, NumberField, Input, toast,
} from "@heroui/react";
import { ensureCatalog, searchLocal, issuerForSymbol, symbolForIssuer, catalogUpdatedAt, fetchThaibmaFeature, type BondCandidate } from "../lib/secApi";
import { deriveCouponSchedule } from "../lib/couponSchedule";
import { createBondHolding } from "../lib/holdings";
import { verifyTaxId, lookupTaxIdName, companyNamesMatch } from "../lib/verifyTaxId";
import { overrideFor } from "../data/couponOverrides";
import { ratingFor } from "../data/bondRatings";
import { notifyPortfolioChanged, useHoldings, type HoldingDetail, type TaxDoc } from "../hooks/usePortfolio";
import { supabase, supabaseEnabled } from "../lib/supabase";
import IssuerLogo from "./IssuerLogo";
import BondDetailModal from "./BondDetailModal";
import AddBondConfirm, { DetailPanel, AnimatedBaht, CompanyCombo, IssueDatePicker as ConfirmDatePicker } from "./AddBondConfirm";
import { issuerName } from "../lib/issuerLogo";
import { IconCheck, IconTrash, IconAlertTriangle, IconPlus, IconMinus, IconChevronRight, IconChevronLeft, IconChevronDown, IconLoader2, IconSparkles, IconInfoCircle } from "@tabler/icons-react";
import emptyBonds from "../assets/empty-bonds.svg";
import addBondMain from "../assets/add-bond-main.png";
import bondDec1 from "../assets/bond-dec-1.png";
import bondEx1 from "../assets/bond-ex-1.png";
import bondEx2 from "../assets/bond-ex-2.png";
import badgeCoupon from "../assets/badges/badge-coupon.svg";
import badgeRating from "../assets/badges/badge-rating.svg";
import badgeAge from "../assets/badges/badge-age.svg";
import beondLogo from "../assets/badges/beond-logo.svg";
import unknownBond from "../assets/badges/unknown-bond.svg";
import addingBond from "../assets/badges/adding-bond.svg";
import dbdLogo from "../assets/badges/dbd-logo.svg";
import dbdVerified from "../assets/badges/dbd-verified.svg";
import { useT } from "../lib/i18n";

// A bond queued in the add-cart, with the user's chosen face value + coupon
// frequency / rating snapshot for that bond.
interface CartItem {
  cand: BondCandidate;
  amount: number;
  freq: number;
  rating: string;
}

interface AddBondModalProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  initialTerm?: string; // prefill the search (e.g. a bond code OCR'd from a slip)
  inline?: boolean; // render the body in place (no Modal chrome), filling its parent
  editHolding?: HoldingDetail | null; // edit an existing holding instead of adding
  slipCount?: number; // confirmed slips accumulated for this bond (delete warning)
  slips?: TaxDoc[]; // confirmed 50-ทวิ slips for this bond — shown as a timeline
  onDelete?: () => void | Promise<void>; // delete the holding being edited
}

// Minimum face value a holding can be added with, and the counter's step.
const MIN_FACE_VALUE = 100_000;

const FREQ_KEY = {
  1: "freq_annual",
  2: "freq_semi",
  4: "freq_quarter",
  12: "freq_monthly",
} as const;

const THAI_MONTHS_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// "X ปี Y เดือน" from a candidate's dates (or its term in years).
function fmtTermThai(b: BondCandidate): string | null {
  let months: number | null = null;
  if (b.issueDate && b.maturityDate) {
    months = Math.max(0, Math.round((new Date(b.maturityDate).getTime() - new Date(b.issueDate).getTime()) / (30.4375 * 864e5)));
  } else if (b.termYears != null) {
    months = Math.round(b.termYears * 12);
  }
  if (months == null || months <= 0) return null;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? `${y} ปี` : "", m ? `${m} เดือน` : ""].filter(Boolean).join(" ") || null;
}

// A small coloured pill used on result cards (interest / rating / term).
function Badge({
  color,
  icon,
  children,
}: {
  color: "blue" | "teal" | "orange";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const styles = {
    blue: "bg-[rgba(31,129,216,0.1)] text-[#1F81D8]",
    teal: "bg-[rgba(2,102,96,0.1)] text-[#016560]",
    orange: "bg-[rgba(255,141,39,0.1)] text-[#FF7800]",
  }[color];
  return (
    <span className={`flex items-center gap-1.5 rounded-full px-3 py-2.5 text-sm font-medium ${styles}`}>
      {icon}
      {children}
    </span>
  );
}

// Placeholder shown while a ThaiBMA lookup resolves — mirrors the result card
// layout (logo + symbol/issuer + badge row) with pulsing grey blocks, plus a
// caption naming the source so the wait is explained.
function SkeletonBondCard({ symbol }: { symbol: string }) {
  const t = useT();
  return (
    <div className="flex shrink-0 flex-col gap-4 rounded-3xl bg-white p-6">
      <div className="flex animate-pulse items-center gap-4">
        <div className="size-16 shrink-0 rounded-full bg-black/10" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="h-4 w-24 rounded bg-black/10" />
          <div className="h-3 w-40 rounded bg-black/5" />
        </div>
      </div>
      <div className="flex animate-pulse flex-wrap gap-2">
        <div className="h-9 w-28 rounded-full bg-black/10" />
        <div className="h-9 w-24 rounded-full bg-black/10" />
        <div className="h-9 w-24 rounded-full bg-black/10" />
      </div>
      <p className="flex items-center gap-2 text-sm text-black/50">
        <IconLoader2 size={16} className="animate-spin" />
        {t("thaibma_fetching_from", { symbol })}
      </p>
    </div>
  );
}

// Collapsible field group for the manual/edit form — a blue block with a
// header row (title + optional done-check) that expands/collapses its content
// with the same spring height animation as the confirm page's accordion.
function FormSection({
  title,
  valid,
  defaultOpen = false,
  children,
}: {
  title: string;
  valid?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-3xl bg-[rgba(30,125,235,0.05)] p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-left"
      >
        <span className="flex flex-1 items-center gap-1.5 text-base font-medium text-black">
          {title}
          {valid && <IconCheck size={16} className="text-[#3FA35B]" stroke={3} />}
        </span>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-black/5 text-black/60">
          <IconChevronDown size={20} className={`transition ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="c"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { type: "spring", stiffness: 400, damping: 40, mass: 0.8 },
              opacity: { duration: 0.2, ease: "easeOut" },
            }}
            className="overflow-hidden"
          >
            <div className="pt-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Right-tab: 50-ทวิ slip collection for a bond, as a timeline. Slips captured
// via LINE OCR vs uploaded in-app are labelled by source; ordered newest first.
function SlipCollectionPanel({ slips }: { slips: TaxDoc[] }) {
  const t = useT();
  const ordered = useMemo(
    () => [...slips].sort((a, b) => (b.payDate ?? "").localeCompare(a.payDate ?? "")),
    [slips],
  );
  const fmtBaht = (n: number | null) => (n == null ? "—" : `฿${n.toLocaleString("th-TH", { maximumFractionDigits: 2 })}`);
  // Any source other than the in-app web upload is a LINE-channel OCR capture.
  const viaLine = (s: TaxDoc) => s.source != null && s.source !== "web_upload";

  if (ordered.length === 0) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 text-center">
        <img src={emptyBonds} alt="" aria-hidden className="h-24 w-auto opacity-70" />
        <p className="max-w-xs text-sm text-black/40">{t("slips_none_yet")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <p className="text-base font-medium text-black">{t("slips_collected_n", { n: String(ordered.length) })}</p>
      <ol className="relative flex flex-col gap-5 pl-6">
        {/* vertical rail */}
        <span className="absolute left-1.75 top-1.5 bottom-1.5 w-px bg-black/10" aria-hidden />
        {ordered.map((s) => (
          <li key={s.id} className="relative">
            {/* dot */}
            <span
              className={`absolute -left-6 top-1 flex size-4 items-center justify-center rounded-full ${viaLine(s) ? "bg-[#5FA548]" : "bg-brand-blue"} text-white`}
              aria-hidden
            >
              <IconCheck size={11} stroke={3} />
            </span>
            <p className="font-nunito text-sm font-medium text-black">{s.payDate ? fmtThaiDate(s.payDate) : "—"}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${viaLine(s) ? "bg-[#E7F5EC] text-[#2E8B57]" : "bg-brand-blue/10 text-brand-blue"}`}
              >
                {viaLine(s) ? t("slip_via_line") : t("slip_via_upload")}
              </span>
              <span className="text-sm text-black/60">{t("wht")} {fmtBaht(s.whtAmount)}</span>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-auto text-xs text-black/40">{t("slips_collection_hint")}</p>
    </div>
  );
}

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


export default function AddBondModal({ open, onClose, onAdded, initialTerm, inline = false, editHolding = null, slipCount = 0, slips = [], onDelete }: AddBondModalProps) {
  const t = useT();
  const editing = !!editHolding;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false); // delete in flight (edge fn can be slow)
  const [manualReview, setManualReview] = useState(false); // summary step before saving a manual entry
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<BondCandidate[]>([]);
  // A ThaiBMA-resolved bond for a term the SEC catalog doesn't have — rendered
  // as a normal result card once found. Reset whenever the term changes.
  const [manualResult, setManualResult] = useState<BondCandidate | null>(null);
  const [tbmaState, setTbmaState] = useState<"idle" | "loading" | "notfound">("idle");
  const [sortDir, setSortDir] = useState<"new" | "old">("new"); // issue-date order
  const sortedResults = useMemo(() => {
    const cmp = (a: BondCandidate, b: BondCandidate) =>
      sortDir === "new"
        ? (b.issueDate ?? "").localeCompare(a.issueDate ?? "")
        : (a.issueDate ?? "").localeCompare(b.issueDate ?? "");
    // Group same-issuer bonds together (consecutive). Group order = the issuer's
    // best bond by the active sort; within a group, bonds also follow the sort.
    const groups = new Map<string, BondCandidate[]>();
    for (const c of results) {
      const key = issuerName(c.symbol, c.issuer);
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(c);
    }
    return [...groups.values()]
      .map((g) => g.sort(cmp))
      .sort((ga, gb) => cmp(ga[0], gb[0]))
      .flat();
  }, [results, sortDir]);
  const [selected, setSelected] = useState<BondCandidate | null>(null);
  const [amount, setAmount] = useState<number>(NaN);
  const [rating, setRating] = useState(""); // credit rating; "" → nonRate
  const [freq, setFreq] = useState(2); // coupon payments per year (SEC omits this)
  // Cart (SEC multi-add): bonds queued from the results list, each with its own
  // face value, added to the portfolio together via saveCart().
  const [cart, setCart] = useState<CartItem[]>([]);
  const inCart = (sym: string) => cart.some((it) => it.cand.symbol === sym);
  // A manual bond with no company resolved yet — shown as a "?" placeholder.
  const isUnknown = (c: BondCandidate) => c.source === "manual" && !c.issuer.trim();
  const [detailBond, setDetailBond] = useState<BondCandidate | null>(null); // bond-detail modal
  const [cartStep, setCartStep] = useState<"select" | "amount">("select"); // add-flow step
  const [continuing, setContinuing] = useState(false); // ThaiBMA prefetch while entering amount step

  // Before the amount step, enrich manually-added (not-in-SEC) bonds from
  // ThaiBMA by their symbol — fills company / issue date / coupon / maturity so
  // the user usually doesn't have to type anything. Best-effort: symbols not on
  // ThaiBMA just stay blank for manual entry.
  async function handleContinue() {
    const manual = cart.filter((it) => it.cand.source === "manual");
    if (manual.length === 0) {
      setCartStep("amount");
      return;
    }
    setContinuing(true);
    const patches = await Promise.all(
      manual.map(async (it) => {
        const f = await fetchThaibmaFeature(it.cand.symbol);
        if (!f) return null;
        // Don't fill issuer — the ThaiBMA company name isn't a SEC catalog name
        // and wouldn't match the confirm-page dropdown; the user picks it there.
        const patch: Partial<BondCandidate> = {};
        if (f.issueDate) patch.issueDate = f.issueDate;
        if (f.maturityDate) patch.maturityDate = f.maturityDate;
        if (f.termYears != null) patch.termYears = f.termYears;
        if (f.isin) patch.isin = f.isin;
        if (f.frequency != null) patch.frequency = f.frequency;
        if (f.couponRate != null) patch.couponRate = f.couponRate;
        return { symbol: it.cand.symbol, patch };
      }),
    );
    const bySym = new Map(patches.filter(Boolean).map((p) => [p!.symbol, p!.patch]));
    if (bySym.size > 0) {
      setCart((prev) =>
        prev.map((x) => (bySym.has(x.cand.symbol) ? { ...x, cand: { ...x.cand, ...bySym.get(x.cand.symbol)! } } : x)),
      );
    }
    setContinuing(false);
    setCartStep("amount");
  }
  // Thai date the loaded SEC catalog snapshot was taken (for the hero note).
  const catalogDate = (() => {
    const at = catalogUpdatedAt();
    if (!at) return "";
    const d = new Date(at);
    return `${d.getDate()} ${THAI_MONTHS_ABBR[d.getMonth()]} ${d.getFullYear() + 543}`;
  })();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Symbols already in the portfolio → disabled in search results (can't add the
  // same bond twice). The bond being edited is excluded so its row stays usable.
  const { holdings } = useHoldings();
  const heldSymbols = useMemo(() => {
    const set = new Set(holdings.map((h) => h.symbol));
    if (editHolding) set.delete(editHolding.symbol);
    return set;
  }, [holdings, editHolding]);

  // Manual entry — for bonds not yet in the SEC feed (e.g. a PO that just closed
  // and isn't settled/registered on ThaiBMA yet).
  const [manual, setManual] = useState(false);
  const [mSymbol, setMSymbol] = useState("");
  const [mIssuer, setMIssuer] = useState("");
  const [mTaxId, setMTaxId] = useState(""); // payer 13-digit tax id (bonds.payer_tax_id)
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

  // Live DBD check as the user types the 13-digit id — no write, just feedback.
  // `checking` while in-flight; `liveName` = official name DBD returned (null =
  // not found), or undefined when the field isn't a full 13 digits.
  const [liveName, setLiveName] = useState<string | null | undefined>(undefined);
  // DBD unreachable ≠ id unknown; keep them apart so an outage doesn't accuse a
  // valid number.
  const [taxLookupFailed, setTaxLookupFailed] = useState(false);
  const [checkingTax, setCheckingTax] = useState(false);
  useEffect(() => {
    const digits = mTaxId.replace(/\D/g, "");
    if (digits.length !== 13) {
      setLiveName(undefined);
      setTaxLookupFailed(false);
      setCheckingTax(false);
      return;
    }
    let alive = true;
    setCheckingTax(true);
    const timer = setTimeout(async () => {
      const r = await lookupTaxIdName(digits);
      if (!alive) return;
      setLiveName(r.name);
      setTaxLookupFailed(r.status === "error");
      setCheckingTax(false);
    }, 400);
    return () => { alive = false; clearTimeout(timer); };
  }, [mTaxId]);
  const liveMatch = liveName ? companyNamesMatch(liveName, mIssuer) : false;

  // The payer tax id belongs to the ISSUER, not the individual series — every
  // bond from the same company shares one 13-digit id. So when this bond's own
  // field is blank (a series that never collected a slip, or one added after a
  // sibling was verified), fill it from a sibling series of the same company.
  //
  // The `issuer` column is unreliable for grouping — the same company appears
  // under different strings across series (e.g. "Origin Property" vs "บริษัท
  // ออริจิ้น พร็อพเพอร์ตี้ จำกัด (มหาชน)") depending on whether the row came from
  // SEC, ThaiBMA or an OCR'd slip. The stable company key is the symbol's ticker
  // prefix (the leading letters, e.g. ORI284B → ORI), so match siblings on that
  // and prefer a DBD-verified id. Runs when adding AND when editing/viewing a
  // holding; only ever fills a blank field, never overrides a typed value.
  const tickerOf = (sym: string) => (sym.trim().toUpperCase().match(/^[A-Z]+/)?.[0] ?? "");
  useEffect(() => {
    if (!supabase || mTaxId.trim() !== "") return;
    const ticker = tickerOf(mSymbol);
    if (ticker.length < 2) return;
    let alive = true;
    supabase
      .from("bonds")
      .select("symbol, payer_tax_id, payer_tax_id_verified")
      .ilike("symbol", `${ticker}%`)
      .not("payer_tax_id", "is", null)
      .then(({ data }) => {
        if (!alive || !data || mTaxId.trim() !== "") return;
        // Keep only rows whose ticker is EXACTLY this one (ilike "TU%" would also
        // catch "TUC…", a different company), verified first.
        const sib = (data as { symbol: string; payer_tax_id: string; payer_tax_id_verified: boolean }[])
          .filter((r) => tickerOf(r.symbol) === ticker && r.payer_tax_id)
          .sort((a, b) => Number(b.payer_tax_id_verified) - Number(a.payer_tax_id_verified))[0];
        if (sib?.payer_tax_id) setMTaxId(sib.payer_tax_id);
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mSymbol, issuerQuery, editing]);

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
    setMIssuer(issuerName(h.symbol, h.issuer));
    setMTaxId(h.payerTaxId ?? "");
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
    if (!open) return;
    setResults(term.trim().length < 2 ? [] : searchLocal(term));
    // A new term invalidates any previous ThaiBMA lookup.
    setManualResult(null);
    setTbmaState("idle");
  }, [term, open]);

  // Try to resolve the current term via ThaiBMA (for symbols not in the SEC
  // catalog). On success it becomes a normal, addable result card.
  async function lookupThaibma() {
    const sym = term.trim().toUpperCase();
    if (!sym) return;
    setTbmaState("loading");
    const f = await fetchThaibmaFeature(sym);
    if (!f) {
      setTbmaState("notfound");
      return;
    }
    setManualResult({
      symbol: f.symbol || sym,
      nameTh: f.issuer || sym,
      nameEn: f.issuer || "",
      isin: f.isin ?? "",
      // Leave issuer blank on purpose: the ThaiBMA company string isn't a SEC
      // catalog name, so it wouldn't match the confirm-page dropdown. The user
      // picks the canonical company there; nameEn keeps it for card display.
      issuer: "",
      couponRate: f.couponRate,
      maturityDate: f.maturityDate,
      issueDate: f.issueDate,
      termYears: f.termYears,
      frequency: f.frequency,
      source: "manual",
    });
    setTbmaState("idle");
  }

  // Catalog miss → fall back to ThaiBMA automatically (debounced so we don't
  // hammer it on every keystroke). The button remains a manual retry.
  useEffect(() => {
    if (!open) return;
    if (term.trim().length < 2 || results.length > 0) return;
    if (manualResult || tbmaState !== "idle") return;
    const id = setTimeout(() => { void lookupThaibma(); }, 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, open, results.length, manualResult, tbmaState]);

  const reset = () => {
    setTerm("");
    setResults([]);
    setSelected(null);
    setCart([]);
    setCartStep("select");
    setAmount(NaN);
    setRating("");
    setFreq(2);
    setError(null);
    setManual(false);
    setMSymbol("");
    setMIssuer("");
    setMTaxId("");
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

  // Verify a saved payer tax id against DBD and surface the result. Only a
  // 13-digit id is checked; a match upgrades the shared catalog to verified.
  const verifyAndToast = async (taxId: string | null, issuer: string, symbol: string) => {
    if (!taxId || taxId.length !== 13) return;
    const res = await verifyTaxId(taxId, issuer, symbol);
    if (res.verified) toast.success(`ยืนยันเลขผู้จ่าย: ${res.officialName ?? ""}`);
    else if (res.officialName) toast.danger(`เลขนี้เป็นของ "${res.officialName}" ไม่ตรงกับผู้ออก — โปรดตรวจสอบ`);
    else toast.danger("ยืนยันกับ DBD ไม่ได้ — บันทึกแบบยังไม่ยืนยัน");
  };

  // Insert one bond holding for the given user (shared DB helper), then verify
  // its payer tax id. Used by the manual/edit single-save + cart multi-add flows.
  const insertHolding = async (
    cand: BondCandidate,
    faceValue: number,
    freqV: number,
    ratingV: string,
    payerTaxId: string | null,
    publicUserId: string,
  ) => {
    await createBondHolding(cand, faceValue, freqV, ratingV, payerTaxId, publicUserId);
    await verifyAndToast(payerTaxId, cand.issuer, cand.symbol);
  };

  // Single save — manual entry and edit mode. `cand` defaults to the manual
  // candidate flow; the SEC multi-add flow uses `saveCart` instead.
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
    // Normalize the payer tax id → 13 digits or null (never a partial string).
    const taxIdDigits = mTaxId.replace(/\D/g, "");
    const payerTaxId = taxIdDigits.length === 13 ? taxIdDigits : null;
    try {
      const { data: authData } = await supabase.auth.getUser();
      const publicUserId = authData.user?.app_metadata?.public_user_id as string | undefined;
      if (!publicUserId) throw new Error(t("err_no_user"));

      // Edit mode: update the existing bond + holding, regenerate payouts.
      if (editHolding) {
        const schedule = deriveCouponSchedule({
          issueDate: cand.issueDate,
          maturityDate: cand.maturityDate,
          termYears: cand.termYears,
          frequency: freq,
          couponRate: cand.couponRate,
          faceValue,
        });
        const { error: bondErr } = await supabase
          .from("bonds")
          .update({
            issuer: cand.issuer,
            coupon_rate: cand.couponRate ?? 0,
            maturity_date: cand.maturityDate,
            issue_date: cand.issueDate,
            coupon_freq: freq,
            rating: rating || null,
            payer_tax_id: payerTaxId,
            payer_tax_id_verified: false,
            payer_verified_name: null,
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
        await verifyAndToast(payerTaxId, cand.issuer, cand.symbol);
        notifyPortfolioChanged();
        toast.success(t("toast_updated", { symbol: cand.symbol }));
        handleClose();
        onAdded();
        return;
      }

      await insertHolding(cand, faceValue, freq, rating, payerTaxId, publicUserId);
      notifyPortfolioChanged();
      toast.success(t("toast_added", { symbol: cand.symbol }));
      onAdded();
      handleClose(); // manual single-shot form
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("err_save_failed");
      setError(msg);
      toast.danger(msg);
    } finally {
      setSaving(false);
    }
  };

  // Add every bond in the cart to the portfolio in one go. Each item carries its
  // own face value; the search results stay put so the user can keep adding.
  const saveCart = async () => {
    if (!cart.length || saving) return;
    const bad = cart.find((it) => !Number.isFinite(it.amount) || it.amount < MIN_FACE_VALUE);
    if (bad) {
      setError(`จำนวนเงินลงทุนขั้นต่ำ ${MIN_FACE_VALUE.toLocaleString("th-TH")} บาท (${bad.cand.symbol})`);
      return;
    }
    // Manual bonds must have a company picked before saving (blank issuer = "?").
    const noCompany = cart.find((it) => it.cand.source === "manual" && !it.cand.issuer.trim());
    if (noCompany) {
      setError(t("err_pick_company", { symbol: noCompany.cand.symbol }));
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
      const { data: authData } = await supabase.auth.getUser();
      const publicUserId = authData.user?.app_metadata?.public_user_id as string | undefined;
      if (!publicUserId) throw new Error(t("err_no_user"));

      const done: string[] = [];
      const failed: string[] = [];
      for (const it of cart) {
        try {
          await insertHolding(it.cand, it.amount, it.freq, it.rating, null, publicUserId);
          done.push(it.cand.symbol);
        } catch (e) {
          failed.push(it.cand.symbol);
          console.error("cart add failed:", it.cand.symbol, e);
        }
      }
      // Only refresh the portfolio when something actually landed.
      if (done.length) {
        notifyPortfolioChanged();
        onAdded();
        toast.success(`เพิ่ม ${done.length} รุ่นเข้าพอร์ตแล้ว`);
      }
      if (failed.length) toast.danger(`เพิ่มไม่สำเร็จ: ${failed.join(", ")}`);
      if (failed.length) {
        // Keep the ones that failed so the user can retry.
        setCart((prev) => prev.filter((it) => failed.includes(it.cand.symbol)));
      } else {
        // All saved — reset and return to the home dashboard.
        handleClose();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("err_save_failed");
      setError(msg);
      toast.danger(msg);
    } finally {
      setSaving(false);
    }
  };

  // Live preview (desktop sidebar) — reflects the selected bond or the manual
  // fields as they're typed.
  const pvSymbol = selected?.symbol || mSymbol;
  const pvCompany = selected ? issuerName(selected.symbol, selected.issuer) : mIssuer;
  const pvCoupon = selected?.couponRate ?? (Number.isFinite(mCoupon) ? mCoupon : null);
  const pvMaturity =
    selected?.maturityDate ??
    (() => {
      if (!mIssue) return null;
      const totalM = (Number.isFinite(mTermY) ? mTermY * 12 : 0) + (Number.isFinite(mTermM) ? mTermM : 0);
      if (!totalM) return null;
      const d = new Date(mIssue);
      d.setMonth(d.getMonth() + totalM);
      return d.toISOString().slice(0, 10);
    })();
  // Live bond record for the detail panel — mirrors the selected bond or the
  // manual fields as they're typed, so the panel updates in real time.
  const [rightTab, setRightTab] = useState<"detail" | "slips">("detail");
  const previewCand: BondCandidate = useMemo(
    () => ({
      symbol: (selected?.symbol || pvSymbol || "").trim().toUpperCase(),
      nameTh: pvCompany || pvSymbol,
      nameEn: pvCompany,
      isin: selected?.isin ?? "",
      issuer: selected?.issuer ?? mIssuer,
      couponRate: pvCoupon,
      maturityDate: pvMaturity,
      issueDate: selected?.issueDate ?? (mIssue || null),
      termYears: selected?.termYears ?? (Number.isFinite(mTermY) ? mTermY : null),
      frequency: freq,
      source: selected?.source ?? "manual",
    }),
    [selected, pvSymbol, pvCompany, pvCoupon, pvMaturity, mIssuer, mIssue, mTermY, freq],
  );

  // Payer 13-digit tax id — white card + DBD verification badge (Figma
  // 1281:4303). Value comes from the 50-ทวิ OCR and is checked against the
  // government business registry. Rendered inside the bond-info accordion when
  // adding, but standalone (no accordion) in edit mode.
  const taxIdCard = (() => {
    const verified =
      (!checkingTax && !!liveName && liveMatch) ||
      (liveName === undefined && editing && !!editHolding?.payerTaxIdVerified);
    const warn =
      !checkingTax &&
      ((!!liveName && !liveMatch) ||
        (liveName === null && !taxLookupFailed) ||
        (liveName === undefined && editing && !!editHolding?.payerTaxId && !editHolding?.payerTaxIdVerified));
    return (
      <div className="flex flex-col items-center gap-2 rounded-3xl bg-[rgba(30,125,235,0.05)] p-2">
        <div className="flex w-full items-center justify-between gap-3 rounded-3xl bg-white p-4">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-base text-black/60">{t("payer_tax_id_label")}</span>
            <input
              value={mTaxId}
              onChange={(e) => setMTaxId(e.target.value.replace(/\D/g, "").slice(0, 13))}
              inputMode="numeric"
              // A DBD-verified id is locked outright — there is no "edit anyway".
              // The number came off the slip and was confirmed against the
              // registry, so any hand-edit can only make it wrong. Editing stays
              // open exactly while it is unverified or absent.
              readOnly={editing && !!editHolding?.payerTaxIdVerified}
              placeholder={t("payer_tax_id_ph")}
              className="min-w-0 bg-transparent font-nunito text-base font-medium text-black outline-none"
            />
          </div>
          {checkingTax ? (
            <div className="relative shrink-0">
              {/* Greyed DBD logo (no check) with a shimmer while the check runs */}
              <img src={dbdLogo} alt="" className="h-7 w-auto animate-pulse grayscale" />
              <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border-2 border-white bg-black/40 text-white">
                <IconLoader2 size={11} className="animate-spin" />
              </span>
            </div>
          ) : verified ? (
            <img src={dbdVerified} alt="ยืนยันโดยกรมพัฒนาธุรกิจการค้า" className="h-8 w-auto shrink-0" />
          ) : warn ? (
            <IconAlertTriangle size={22} className="shrink-0 text-[#B7791F]" />
          ) : mTaxId.trim() === "" ? (
            // Not entered yet — a learn-more hint about where the number comes from.
            <div className="group relative shrink-0">
              <IconInfoCircle size={22} className="text-black/40 transition hover:text-black/70" />
              <div className="pointer-events-none absolute right-0 top-full z-30 mt-2 w-64 rounded-xl bg-[#222] p-3 text-left text-xs leading-relaxed text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                เลข 13 หลักของผู้จ่ายเงินได้อยู่บนสลิป 50 ทวิ ที่ได้รับพร้อมดอกเบี้ย — ระบบจะตรวจสอบชื่อกับกรมพัฒนาธุรกิจการค้าให้อัตโนมัติ
              </div>
            </div>
          ) : null}
        </div>
        {/* Plain-language status — conveys OCR source + registry check */}
        <div className="flex w-full flex-col items-center gap-1 px-1 text-center">
          {checkingTax ? (
            <p className="text-xs text-black/40">กำลังตรวจสอบกับกรมพัฒนาธุรกิจการค้า…</p>
          ) : verified ? (
            <p className="text-xs text-[#222]">เลขนี้ยืนยันจากสลิป 50 ทวิ และตรวจสอบกับกรมพัฒนาธุรกิจการค้าแล้ว</p>
          ) : !!liveName && !liveMatch ? (
            <p className="text-xs text-[#B7791F]">เลขนี้จดทะเบียนในชื่อ “{liveName}” ไม่ตรงกับบริษัทผู้ออก — ตรวจสอบอีกครั้ง</p>
          ) : taxLookupFailed ? (
            <p className="text-xs text-black/40">ระบบตรวจสอบของกรมพัฒนาธุรกิจการค้าขัดข้องชั่วคราว (ไม่ใช่ปัญหาจาก beond) — บันทึกได้ตามปกติ แล้วระบบจะตรวจสอบให้ภายหลัง</p>
          ) : liveName === null ? (
            <p className="text-xs text-[#B7791F]">ไม่พบเลขนี้ในทะเบียนกรมพัฒนาธุรกิจการค้า</p>
          ) : warn ? (
            <p className="text-xs text-[#B7791F]">ยังไม่ได้ยืนยันเลขนี้กับกรมพัฒนาธุรกิจการค้า</p>
          ) : (
            <p className="text-xs text-black/40">เลข 13 หลักจากสลิป 50 ทวิ — ระบบตรวจสอบชื่อกับกรมพัฒนาธุรกิจการค้าให้อัตโนมัติ</p>
          )}
        </div>
      </div>
    );
  })();

  // Right column — folder tabs over a card: bond detail (same layout as the
  // confirm page) + the slip-collection tab for this bond.
  const preview = (
    <aside className="hidden min-h-0 flex-col lg:flex">
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={() => setRightTab("detail")}
          className={`rounded-t-2xl border-[0.5px] border-b-0 px-4 py-2.5 text-sm font-medium transition ${
            rightTab === "detail" ? "border-[#d9d9d9] bg-white text-ink" : "border-transparent bg-black/5 text-ink/50 hover:bg-black/10"
          }`}
        >
          {t("bond_details")}
        </button>
        <button
          type="button"
          onClick={() => setRightTab("slips")}
          className={`flex items-center gap-1.5 rounded-t-2xl border-[0.5px] border-b-0 px-4 py-2.5 text-sm font-medium transition ${
            rightTab === "slips" ? "border-[#d9d9d9] bg-white text-ink" : "border-transparent bg-black/5 text-ink/50 hover:bg-black/10"
          }`}
        >
          {t("slip_collection")}
          {slipCount > 0 && (
            <span className="flex min-w-5 items-center justify-center rounded-full bg-[#5FA548] px-1.5 font-nunito text-[11px] font-bold text-white">{slipCount}</span>
          )}
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto rounded-3xl rounded-tl-none border-[0.5px] border-[#d9d9d9] bg-white p-6">
        {rightTab === "detail" ? (
          <DetailPanel cand={previewCand} />
        ) : (
          <SlipCollectionPanel slips={slips} />
        )}
      </div>
    </aside>
  );

  const body = (
    <>
        {/* Outer header only for the manual review step — the 2-column edit view
            carries its own header inside the left card. */}
        {manual && manualReview && (
        <div className="relative flex items-start justify-between">
          <div className="min-w-0">
            {/* Breadcrumb removed for now — kept commented until re-enabled.
            <Breadcrumbs separator="/">
              {editing ? (
                <>
                  <Breadcrumbs.Item onPress={handleClose}>{t("holdings_title")}</Breadcrumbs.Item>
                  <Breadcrumbs.Item>{t("edit")}</Breadcrumbs.Item>
                </>
              ) : (
                <>
                  <Breadcrumbs.Item onPress={handleClose}>{t("add_bond")}</Breadcrumbs.Item>
                  <Breadcrumbs.Item>{t("search")}</Breadcrumbs.Item>
                </>
              )}
            </Breadcrumbs>
            */}
            {/* Search state shows its title inside the search card instead. */}
            {manual && (
              <h3 className="mt-1 text-3xl font-medium text-[#181D20]">
                {editing ? t("edit") : t("manual_entry")}
              </h3>
            )}
            {editing && (
              <p className="mt-1 font-nunito text-sm text-black/80">{mSymbol}</p>
            )}
            {manual && !editing && (
              <p className="mt-1 max-w-md text-sm text-black/80">
                {t("manual_hint")}
              </p>
            )}
          </div>
          {/* Add-bond art — search shows it inside the search card instead, so
              only the manual/edit header keeps this cluster. */}
          {manual && (
            <div className="pointer-events-none absolute -top-8 right-6 z-0 h-36 w-60" aria-hidden>
              <img src={bondEx2} alt="" className="absolute left-24 top-0 h-6 w-auto" />
              <img src={bondEx1} alt="" className="absolute left-2 top-20 h-12 w-auto" />
              <img src={addBondMain} alt="" className="absolute right-0 top-2 h-28 w-auto" />
            </div>
          )}
        </div>
        )}

        <div className={`min-h-0 flex-1 gap-6 ${manual && !manualReview ? "grid lg:grid-cols-2" : "flex"}`}>
        <div className="flex min-h-0 flex-1 flex-col">
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
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border-[0.5px] border-black/10 bg-white">
              {/* Back — inside the card, matching the confirm page */}
              <div className="p-6 pb-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex w-fit items-center gap-1.5 rounded-full border-[0.5px] border-black/10 bg-[#f5f5f5] px-3 py-2 text-sm font-medium text-[#222] transition hover:bg-black/5"
                >
                  <IconChevronLeft size={18} /> {t("back")}
                </button>
              </div>
              {/* Header + illustration */}
              <div className="flex items-start justify-between gap-4 p-6">
                <div className="min-w-0">
                  <p className="font-nunito text-xl font-medium text-black">{mSymbol.trim() ? mSymbol.trim().toUpperCase() : (editing ? t("edit") : t("manual_entry"))}</p>
                  <p className="mt-1 text-sm text-black/60">{editing ? t("edit") : t("manual_hint")}</p>
                </div>
                <img src={addingBond} alt="" aria-hidden className="h-16 w-auto shrink-0" />
              </div>
              {/* Stacked field blocks — same look as the confirm page */}
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto border-t-[0.5px] border-black/10 p-4">
                {/* Invested value — stepper pill */}
                <div className="flex items-center justify-between gap-3 rounded-3xl bg-[rgba(30,125,235,0.05)] p-4">
                  <div className="min-w-0">
                    <p className="text-base text-black/60">{t("invested_value")}</p>
                    <p className="mt-1 font-nunito text-2xl font-medium text-black">
                      <AnimatedBaht value={Number.isFinite(amount) ? amount : 0} />
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <motion.button
                      type="button"
                      aria-label="-"
                      disabled={!Number.isFinite(amount) || amount <= MIN_FACE_VALUE}
                      onClick={() => setAmount(Math.max(MIN_FACE_VALUE, (Number.isFinite(amount) ? amount : MIN_FACE_VALUE) - MIN_FACE_VALUE))}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      className="flex size-12 items-center justify-center rounded-full bg-brand-blue text-white hover:bg-[#215688] disabled:opacity-40"
                    >
                      <IconMinus size={24} />
                    </motion.button>
                    <motion.button
                      type="button"
                      aria-label="+"
                      onClick={() => setAmount((Number.isFinite(amount) ? amount : 0) + MIN_FACE_VALUE)}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      className="flex size-12 items-center justify-center rounded-full bg-brand-blue text-white hover:bg-[#215688]"
                    >
                      <IconPlus size={24} />
                    </motion.button>
                  </div>
                </div>
                {/* Bond info — symbol + company (add only). In edit mode the bond
                    is fixed, so the whole accordion is skipped and only the payer
                    tax-id card shows, standalone (rendered below). */}
                {editing ? (
                  taxIdCard
                ) : (
                <FormSection title={t("bond_info")} valid={infoValid} defaultOpen>
                  <div className="flex flex-col gap-3">
                      <label className="flex flex-col gap-1 text-sm font-medium text-black/60">
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
                      {/* Company — same white-card combobox as the confirm page */}
                      <CompanyCombo value={mIssuer} onChange={setMIssuer} />
                      {taxIdCard}
                  </div>
                </FormSection>
                )}
                {/* Yield + term are fixed once the bond is in the portfolio —
                    shown only when adding, hidden in edit mode. */}
                {!editing && (<>
                <FormSection title={t("yield_section")} valid={yieldValid}>
                  <div className="flex flex-col gap-3">
                      {/* Coupon rate — white card + % suffix (matches confirm) */}
                      <div className="flex w-full items-center justify-between gap-2 rounded-3xl bg-white p-4">
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="text-xs text-[#222]">{t("coupon_rate")}</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.1"
                            value={Number.isFinite(mCoupon) ? mCoupon : ""}
                            onChange={(e) => setMCoupon(e.target.value === "" ? NaN : Number(e.target.value))}
                            placeholder="0.00"
                            className="min-w-0 bg-transparent font-nunito text-base font-medium text-[#222] outline-none"
                          />
                        </div>
                        <span className="shrink-0 text-xs font-medium text-[#222]/60">%</span>
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
                  </div>
                </FormSection>
                {/* Term — issue date + tenor */}
                <FormSection title={t("term")} valid={termValid}>
                  <div className="flex flex-col gap-3">
                      {/* Issue date — white-card picker (matches confirm) */}
                      <ConfirmDatePicker value={mIssue} onChange={setMIssue} />
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
                  </div>
                </FormSection>
                </>)}
                </div>
              </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex shrink-0 items-center gap-2">
              {editing && onDelete && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  aria-label="ลบหุ้นกู้นี้"
                  title="ลบหุ้นกู้นี้"
                  className="flex size-14 shrink-0 items-center justify-center rounded-full border-[0.5px] border-[#D64545]/40 text-[#D64545] transition hover:bg-[#FBEBEB]"
                >
                  <IconTrash size={22} />
                </button>
              )}
              <button
                onClick={editing ? saveManual : goManualReview}
                disabled={saving}
                className="flex flex-1 items-center justify-center rounded-full bg-brand-blue py-4 text-xl font-medium text-white transition hover:bg-[#215688] disabled:opacity-60"
              >
                {editing ? (saving ? t("saving") : t("save")) : t("review")}
              </button>
            </div>

          {/* Delete confirmation — heroUI modal. Warns that accumulated slips
              go with the holding. */}
          <Modal isOpen={confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(false); }}>
            <ModalBackdrop isDismissable>
              <ModalContainer placement="center">
                <ModalDialog className="flex w-full max-w-sm flex-col gap-4 rounded-3xl bg-white p-6">
                  <div className="flex flex-col gap-2">
                    <div className="flex size-11 items-center justify-center rounded-full bg-[#FBEBEB] text-[#D64545]">
                      <IconTrash size={22} />
                    </div>
                    <h3 className="text-lg font-medium text-ink">ลบ {mSymbol} ออกจากพอร์ต?</h3>
                    <p className="text-sm text-black/60">การลบนี้ไม่สามารถกู้คืนได้</p>
                  </div>
                  {/* Slip warning — prominent amber callout when the bond has
                      collected 50-ทวิ slips, since they're deleted along with it. */}
                  {slipCount > 0 && (
                    <div className="flex items-start gap-2.5 rounded-2xl bg-[#FDF3E7] p-3 text-[#B7791F]">
                      <IconAlertTriangle size={20} className="mt-0.5 shrink-0" />
                      <p className="text-sm leading-normal">
                        หุ้นกู้นี้มีสลิป 50 ทวิ ที่สะสมไว้ <span className="font-nunito font-semibold">{slipCount}</span> ใบ — ลบแล้ว<span className="font-semibold">สลิปและเครดิตภาษีจะถูกลบไปด้วย</span> และกู้คืนไม่ได้
                      </p>
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                      className="rounded-2xl border-[0.5px] border-[#d9d9d9] bg-white px-4 py-2.5 text-base font-medium text-ink transition hover:bg-[#F0F2F7] disabled:opacity-50"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={async () => {
                        if (deleting) return;
                        setDeleting(true);
                        // onDelete (delHolding) clears slips server-side then the
                        // holding — can take a moment; keep the spinner until done.
                        try { await onDelete?.(); } finally { setDeleting(false); }
                      }}
                      disabled={deleting}
                      className="flex items-center gap-2 rounded-2xl bg-[#D64545] px-4 py-2.5 text-base font-medium text-white transition hover:bg-[#c23c3c] disabled:opacity-70"
                    >
                      {deleting ? (
                        <>
                          <IconLoader2 size={18} className="animate-spin" /> กำลังลบ…
                        </>
                      ) : (
                        <>
                          ยืนยันลบ
                          <IconTrash size={18} />
                        </>
                      )}
                    </button>
                  </div>
                </ModalDialog>
              </ModalContainer>
            </ModalBackdrop>
          </Modal>
          </div>
        ) : cartStep === "amount" && cart.length > 0 ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <AddBondConfirm
              items={cart}
              minFaceValue={MIN_FACE_VALUE}
              saving={saving}
              error={error}
              onChangeAmount={(sym, v) => setCart((prev) => prev.map((x) => (x.cand.symbol === sym ? { ...x, amount: v } : x)))}
              onChangeField={(sym, patch) => setCart((prev) => prev.map((x) => (x.cand.symbol === sym ? { ...x, cand: { ...x.cand, ...patch } } : x)))}
              onBack={() => setCartStep("select")}
              onSave={() => saveCart()}
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-6">
            {/* Hero — blue banner with back, title, search pill (Figma 1148:3732).
                Right-side illustrations are assets, added later. */}
            <div className="relative shrink-0 overflow-hidden rounded-3xl bg-[#2968a5] px-10 py-9">
              {/* Right-side illustration cluster (Figma 1148:3762). */}
              <div className="pointer-events-none absolute inset-y-0 right-6 hidden w-96 xl:block" aria-hidden>
                <img src={addBondMain} alt="" className="absolute right-4 top-1/2 h-44 w-auto -translate-y-1/2" />
                <img src={bondEx1} alt="" className="absolute bottom-8 right-64 h-16 w-auto" />
                <img src={bondEx2} alt="" className="absolute right-72 top-10 h-10 w-auto blur-[0.5px]" />
                <img src={bondDec1} alt="" className="absolute -right-6 -top-2 h-24 w-auto -scale-x-100 blur-[0.5px]" />
              </div>
              <div className="relative flex max-w-2xl flex-col gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex w-fit items-center gap-1.5 rounded-full border-[0.5px] border-black/10 bg-[#f5f5f5] px-3 py-2 text-sm font-medium text-[#222] transition hover:bg-white"
                >
                  <IconChevronLeft size={18} /> {t("back")}
                </button>
                <h2 className="text-3xl font-medium text-white">{t("add_bond_hero_title")}</h2>
                <p className="text-base leading-normal text-white/80">
                  {t("add_bond_hero_sub1")}
                  <br />
                  {t("add_bond_hero_sub2")}
                </p>
                <SearchField value={term} onChange={setTerm} aria-label={t("search_bond")} className="w-full max-w-[542px]">
                  <SearchField.Group className="h-14 rounded-full border border-black/10 bg-white px-4">
                    <SearchField.SearchIcon className="text-brand-blue" />
                    <SearchField.Input autoFocus placeholder={t("search_hint")} className="font-normal! text-brand-blue placeholder:text-brand-blue/70" />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>
                <p className="text-sm text-white/80">{t("sec_source_dated", { date: catalogDate })}</p>
              </div>
            </div>

            {/* Results (left) + cart (right) — shown once a query is typed, and
                kept visible while the cart has items even after clearing search. */}
            {(term.trim().length >= 2 || cart.length > 0) && (
            <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,492px)]">
              {/* LEFT — one card per result */}
              <div className="flex min-h-0 flex-col gap-3">
                <div className="flex shrink-0 items-center justify-between gap-2">
                  <p className="text-base font-medium text-black">
                    {t("found_n_items", { n: String(results.length) })}
                  </p>
                  {/* Sort by issue date — newest / oldest. */}
                  {results.length > 1 && (
                    <div className="flex rounded-full bg-black/5 p-0.5 text-xs">
                      {(["new", "old"] as const).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setSortDir(d)}
                          className={`rounded-full px-2.5 py-1 font-medium transition ${
                            sortDir === d ? "bg-white text-ink shadow-sm" : "text-ink/50 hover:text-ink/80"
                          }`}
                        >
                          {d === "new" ? "ออกล่าสุด" : "ออกเก่าสุด"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div
                  ref={resultsFade.ref}
                  onScroll={resultsFade.onScroll}
                  style={{ WebkitMaskImage: resultsFade.mask, maskImage: resultsFade.mask }}
                  className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1"
                >
                  {term.trim().length < 2 && (
                    <div className="flex flex-col items-center gap-3 rounded-3xl bg-white p-8 text-center">
                      <img src={emptyBonds} alt="" aria-hidden className="h-28 w-auto opacity-90" />
                      <p className="text-sm font-medium text-black/60">{t("search_to_add_more")}</p>
                    </div>
                  )}
                  {/* Catalog miss: skeleton while ThaiBMA resolves (idle = pending
                      auto-fetch, or loading), then a fallback card if not found. */}
                  {term.trim().length >= 2 && results.length === 0 && !manualResult && tbmaState !== "notfound" && (
                    <SkeletonBondCard symbol={term.trim().toUpperCase()} />
                  )}
                  {term.trim().length >= 2 && results.length === 0 && !manualResult && tbmaState === "notfound" && (
                    <div className="flex shrink-0 flex-col gap-4 rounded-3xl bg-white p-6">
                      {/* Not on ThaiBMA either — retry or keep as a placeholder */}
                      <div className="flex items-center gap-4">
                        <div className="flex size-16 shrink-0 items-center justify-center rounded-full border border-black/10">
                          <img src={unknownBond} alt="" className="h-10 w-auto" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-base font-medium text-black">{term.trim().toUpperCase()}</p>
                          <p className="truncate text-sm text-black/60">{t("thaibma_not_found")}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={lookupThaibma}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-blue px-3 py-3 text-sm font-medium text-white transition hover:bg-[#215688]"
                      >
                        <IconSparkles size={18} />
                        {t("thaibma_lookup")}
                      </button>
                      <button
                        onClick={() => {
                          const sym = term.trim().toUpperCase();
                          if (!sym || inCart(sym) || heldSymbols.has(sym)) return;
                          // Fallback: queue an unknown placeholder to fill in later.
                          setCart((prev) => [
                            ...prev,
                            {
                              cand: {
                                symbol: sym, nameTh: sym, nameEn: "", isin: "", issuer: "",
                                couponRate: null, maturityDate: null, issueDate: null,
                                termYears: null, frequency: null, source: "manual",
                              },
                              amount: MIN_FACE_VALUE,
                              freq: 2,
                              rating: "",
                            },
                          ]);
                          setTerm("");
                          setError(null);
                        }}
                        className="w-full rounded-2xl border border-dashed border-[#43507F]/40 px-3 py-3 text-sm font-medium text-[#43507F] transition-colors hover:bg-[#43507F]/5"
                      >
                        {t("keep_unknown", { term: term.trim() })}
                      </button>
                    </div>
                  )}
                  {(sortedResults.length ? sortedResults : manualResult ? [manualResult] : []).map((b) => {
                    const owned = heldSymbols.has(b.symbol);
                    const termStr = fmtTermThai(b);
                    const rate = ratingFor(b.symbol);
                    const queued = inCart(b.symbol);
                    return (
                      <div
                        key={b.symbol}
                        className={`flex shrink-0 flex-col gap-4 rounded-3xl bg-white p-6 transition ${owned ? "opacity-50" : ""}`}
                      >
                        {/* Top row: logo + symbol/issuer, bookmark far right */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-4">
                            <IssuerLogo symbol={b.symbol} name={issuerName(b.symbol, b.issuer || b.nameEn)} size={64} className="rounded-full!" />
                            <div className="min-w-0">
                              <p className="text-base font-medium text-black">{b.symbol}</p>
                              <p className="truncate text-sm text-black/60">{issuerName(b.symbol, b.issuer || b.nameEn)}</p>
                            </div>
                          </div>
                          {owned ? (
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-black/10 text-black/40" title={t("owned_badge")}>
                              <IconCheck size={20} />
                            </div>
                          ) : (
                            <button
                              type="button"
                              aria-label={queued ? t("in_cart") : t("add_to_cart")}
                              onClick={() =>
                                queued
                                  ? setCart((prev) => prev.filter((it) => it.cand.symbol !== b.symbol))
                                  : setCart((prev) => [
                                      ...prev,
                                      {
                                        cand: b,
                                        amount: MIN_FACE_VALUE,
                                        freq: overrideFor(b.symbol)?.frequency ?? b.frequency ?? 2,
                                        rating: ratingFor(b.symbol) ?? "",
                                      },
                                    ])
                              }
                              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#5FA548] text-white transition hover:bg-[#52913D]"
                            >
                              {queued ? <IconCheck size={20} /> : <IconPlus size={20} />}
                            </button>
                          )}
                        </div>
                        {/* Badges + detail — full width, detail pinned right */}
                        <div className="flex w-full flex-wrap items-center gap-2">
                          {typeof b.couponRate === "number" && Number.isFinite(b.couponRate) && (
                            <Badge color="blue" icon={<img src={badgeCoupon} alt="" className="h-5 w-auto" />}>
                              {t("interest")} {b.couponRate}%
                            </Badge>
                          )}
                          {rate && (
                            <Badge color="teal" icon={<img src={badgeRating} alt="" className="h-5 w-auto" />}>
                              {t("rating")} {rate}
                            </Badge>
                          )}
                          {termStr && (
                            <Badge color="orange" icon={<img src={badgeAge} alt="" className="h-5 w-auto" />}>
                              {t("age")} {termStr}
                            </Badge>
                          )}
                          <button
                            type="button"
                            onClick={() => setDetailBond(b)}
                            className="ml-auto flex h-9 items-center rounded-lg border-[0.5px] border-black/10 px-3 text-sm font-medium text-black/60 transition hover:bg-black/5"
                          >
                            {t("bond_details")}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT — cart panel (Figma 1153:4202). Queued bonds +
                  "ดำเนินการต่อ" → the amount-entry step (full page). */}
              <div className="flex min-h-0 flex-col rounded-3xl bg-brand-blue/10 p-6">
                {cart.length === 0 ? (
                  <div className="flex h-full min-h-60 flex-col items-center justify-center p-8 text-center">
                    <img src={emptyBonds} alt="" aria-hidden className="h-24 w-auto opacity-70" />
                    <p className="mt-3 text-sm text-black/40">{t("cart_empty")}</p>
                  </div>
                ) : (
                  <>
                    <div className="flex shrink-0 items-center justify-between gap-3 pb-4">
                      <img src={beondLogo} alt="beond" className="h-16 w-auto" />
                      <button
                        type="button"
                        onClick={handleContinue}
                        disabled={continuing}
                        className="flex items-center gap-1.5 rounded-full bg-brand-blue py-2 pl-4 pr-3 text-sm font-medium text-white transition hover:bg-[#215688] disabled:opacity-60"
                      >
                        {continuing ? t("thaibma_fetching") : t("continue")}
                        {continuing ? <IconLoader2 size={20} className="animate-spin" /> : <IconChevronRight size={20} />}
                      </button>
                    </div>
                    <p className="shrink-0 pb-3 text-base font-medium text-black">{t("bonds_to_add")}</p>
                    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
                      <AnimatePresence>
                        {cart.map((it) => (
                          <motion.div
                            key={it.cand.symbol}
                            layout
                            initial={{ opacity: 0, y: -10, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98, height: 0, marginTop: 0 }}
                            transition={{
                              layout: { type: "spring", stiffness: 500, damping: 42, mass: 0.7 },
                              default: { type: "spring", stiffness: 420, damping: 38, mass: 0.7 },
                              opacity: { duration: 0.25, ease: "easeOut" },
                            }}
                            className="flex items-center gap-4 rounded-3xl bg-white p-4"
                          >
                            {isUnknown(it.cand) ? (
                              <div className="flex size-16 shrink-0 items-center justify-center rounded-full border border-black/10">
                                <img src={unknownBond} alt="" className="h-10 w-auto" />
                              </div>
                            ) : (
                              <IssuerLogo symbol={it.cand.symbol} name={issuerName(it.cand.symbol, it.cand.issuer)} size={64} className="rounded-full!" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-base font-medium text-black">{it.cand.symbol}</p>
                              <p className="truncate text-sm text-black/60">
                                {isUnknown(it.cand) ? t("no_company_yet") : issuerName(it.cand.symbol, it.cand.issuer)}
                              </p>
                            </div>
                            <button
                              type="button"
                              aria-label={t("remove")}
                              onClick={() => setCart((prev) => prev.filter((x) => x.cand.symbol !== it.cand.symbol))}
                              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-black/10 text-black/50 transition hover:bg-[#D64545]/10 hover:text-[#D64545]"
                            >
                              <IconTrash size={20} />
                            </button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </>
                )}
              </div>
            </div>
            )}
          </div>
        )}
        </div>
        {inline && manual && !manualReview && preview}
        </div>
    </>
  );

  // Inline mode: fill the host panel, no Modal chrome. In the search state the
  // panel stays transparent so its inner cards (search / results / selected)
  // read as separate cards; other states sit on a single white card.
  if (inline) {
    if (!open) return null;
    // Views whose panels are their own cards on a transparent background: the
    // search/results/cart state, and the manual/edit 2-column view (left form
    // card + right detail card). Only the manual review step sits on one card.
    const separateCards = !manual || !manualReview;
    return (
      <div
        className={`relative flex h-full w-full flex-col ${separateCards ? "" : "overflow-hidden rounded-3xl bg-white p-6"}`}
      >
        {!separateCards && (
          <img src={bondDec1} alt="" aria-hidden className="pointer-events-none absolute -right-2 -top-1 h-10 w-auto rotate-18" />
        )}
        {body}
        <BondDetailModal open={!!detailBond} candidate={detailBond} onClose={() => setDetailBond(null)} />
      </div>
    );
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
      <BondDetailModal open={!!detailBond} candidate={detailBond} onClose={() => setDetailBond(null)} />
    </Modal>
  );
}
