import { useEffect, useMemo, useState } from "react";
import { Modal, ModalBackdrop, ModalContainer, ModalDialog } from "@heroui/react";
import { IconX, IconLoader2 } from "@tabler/icons-react";
import { fetchBondDetail, type BondCandidate, type BondDetail } from "../lib/secApi";
import { deriveCouponSchedule, parseFrequency } from "../lib/couponSchedule";
import { issuerName } from "../lib/issuerLogo";
import { ratingFor } from "../data/bondRatings";
import { overrideFor } from "../data/couponOverrides";
import IssuerLogo from "./IssuerLogo";
import { useT } from "../lib/i18n";

const THAI_MONTHS_ABBR = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

// ISO date → Thai Buddhist-era short date, e.g. "2028-08-13" → "13 ส.ค. 2571".
function fmtThaiDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${THAI_MONTHS_ABBR[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function fmtBaht(v: number | null): string {
  return v == null ? "—" : `฿${v.toLocaleString("th-TH")}`;
}

// Coupon-frequency (payments/year) → Thai label.
const FREQ_LABEL: Record<number, string> = {
  1: "ปีละครั้ง",
  2: "ทุก 6 เดือน",
  4: "ทุก 3 เดือน",
  12: "ทุกเดือน",
};

// A term expressed as year / month / day → Thai text.
function fmtTerm(y: number | null, m: number | null, d: number | null): string {
  const parts = [
    y ? `${y} ปี` : "",
    m ? `${m} เดือน` : "",
    d ? `${d} วัน` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" ") : "—";
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="shrink-0 text-sm text-black/50">{label}</span>
      <span className="text-right text-sm font-medium text-black">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-[0.5px] border-black/10 p-4">
      <p className="mb-1 text-base font-medium text-black">{title}</p>
      <div className="divide-y divide-black/5">{children}</div>
    </div>
  );
}

interface Props {
  open: boolean;
  candidate: BondCandidate | null;
  onClose: () => void;
}

// Deep-detail view for a single bond — fetches the full SEC feature row on
// demand and lays it out in sections (instrument / offering / coupon schedule).
// Falls back to the slim catalog candidate when the live fetch is unavailable
// (e.g. no dev proxy in production).
export default function BondDetailModal({ open, candidate, onClose }: Props) {
  const t = useT();
  const [detail, setDetail] = useState<BondDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !candidate) return;
    setDetail(null);
    setLoading(true);
    const ac = new AbortController();
    fetchBondDetail(candidate.symbol, ac.signal)
      .then((d) => setDetail(d))
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [open, candidate]);

  // The slim candidate is the fallback while the richer detail loads / fails.
  const sym = candidate?.symbol ?? "";
  const issuer = candidate ? issuerName(candidate.symbol, candidate.issuer) : "";
  const rating = sym ? ratingFor(sym) : null;
  const couponRate = detail?.couponRate ?? candidate?.couponRate ?? null;

  // Coupon frequency (payments/year): manual override → catalog → parsed from
  // the coupon text → default half-yearly.
  const freq =
    overrideFor(sym)?.frequency ??
    candidate?.frequency ??
    parseFrequency(detail?.couponDesc ?? detail?.couponName) ??
    2;

  // Interest-payment dates, shown per ฿100,000 face so the amount is meaningful.
  const schedule = useMemo(() => {
    if (!candidate) return [];
    return deriveCouponSchedule({
      issueDate: detail?.issueDate ?? candidate.issueDate,
      maturityDate: detail?.maturityDate ?? candidate.maturityDate,
      termYears: detail?.termYears ?? candidate.termYears,
      frequency: freq,
      couponRate,
      faceValue: 100_000,
    });
  }, [candidate, detail, freq, couponRate]);

  if (!candidate) return null;

  return (
    <Modal isOpen={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <ModalBackdrop isDismissable>
        <ModalContainer placement="center">
          <ModalDialog className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl bg-white">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 p-6 pb-4">
              <div className="flex min-w-0 items-center gap-3">
                <IssuerLogo symbol={sym} name={issuer} size={56} className="rounded-2xl!" />
                <div className="min-w-0">
                  <p className="text-2xl font-medium text-black">{sym}</p>
                  <p className="truncate text-sm text-black/60">{issuer}</p>
                </div>
              </div>
              <button
                type="button"
                aria-label={t("close")}
                onClick={onClose}
                className="-mr-1 -mt-1 shrink-0 rounded-full p-2 text-black/40 transition hover:bg-black/5"
              >
                <IconX size={20} />
              </button>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 px-6 pb-4">
              {rating && (
                <span className="rounded-full bg-[#E7F5EC] px-3 py-1 font-nunito text-xs font-medium text-[#2E8B57]">
                  {t("rating")} {rating}
                </span>
              )}
              {detail?.offerAbbr && (
                <span className="rounded-full bg-[#EEF2F8] px-3 py-1 text-xs font-medium text-brand-blue">
                  {detail.offerAbbr}
                </span>
              )}
              {detail?.esgType && (
                <span className="rounded-full bg-[#E7F5EC] px-3 py-1 text-xs font-medium text-[#2E8B57]">
                  ESG · {detail.esgType}
                </span>
              )}
            </div>

            {/* Body */}
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 pb-6">
              {loading && (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-black/40">
                  <IconLoader2 size={18} className="animate-spin" /> {t("loading")}
                </div>
              )}

              <Section title={t("key_terms")}>
                <Row
                  label={t("coupon_rate")}
                  value={
                    couponRate != null
                      ? `${couponRate}% ${t("per_year")}`
                      : detail?.couponRateText ?? "—"
                  }
                />
                <Row label={t("pays_interest")} value={FREQ_LABEL[freq] ?? "—"} />
                <Row label={t("issue_date")} value={fmtThaiDate(detail?.issueDate ?? candidate.issueDate)} />
                <Row label={t("maturity")} value={fmtThaiDate(detail?.maturityDate ?? candidate.maturityDate)} />
                <Row
                  label={t("redeem_term")}
                  value={fmtTerm(detail?.termYears ?? candidate.termYears ?? null, detail?.termMonth ?? null, detail?.termDay ?? null)}
                />
              </Section>

              {/* SEC has no market price / YTM — be explicit rather than fake it. */}
              <Section title={t("price_yield")}>
                <Row label={t("face_coupon_yield")} value={couponRate != null ? `${couponRate}%` : "—"} />
                <Row label={t("market_price")} value={<span className="text-black/40">{t("no_sec_data")}</span>} />
                <Row label={t("ytm")} value={<span className="text-black/40">{t("no_sec_data")}</span>} />
              </Section>

              <Section title={t("instrument_info")}>
                <Row label={t("security_kind")} value={detail?.securityType ?? "—"} />
                <Row label={t("secured_kind")} value={detail?.secured ?? "—"} />
                <Row label={t("subordination")} value={detail?.subordinated ?? "—"} />
                <Row label={t("call_option")} value={detail?.embeddedOption ?? "—"} />
                <Row label={t("repayment")} value={detail?.redemption ?? "—"} />
                <Row label="ISIN" value={<span className="font-nunito">{detail?.isin || candidate.isin || "—"}</span>} />
              </Section>

              <Section title={t("offering_info")}>
                <Row label={t("investor_class")} value={detail?.offerType ?? "—"} />
                <Row label={t("min_unit")} value={fmtBaht(detail?.unit ?? null)} />
                <Row label={t("issue_size")} value={fmtBaht(detail?.offerValue ?? null)} />
                <Row label={t("currency")} value={detail?.currency ?? "—"} />
                <Row
                  label={t("subscription_period")}
                  value={
                    detail?.sellingBegin
                      ? `${fmtThaiDate(detail.sellingBegin)} – ${fmtThaiDate(detail.sellingClose)}`
                      : "—"
                  }
                />
              </Section>

              {schedule.length > 0 && (
                <Section title={`${t("interest_dates")} (${t("per")} ฿100,000)`}>
                  {schedule.map((p) => (
                    <Row
                      key={p.installment}
                      label={`${t("installment")} ${p.installment} · ${fmtThaiDate(p.date)}`}
                      value={<span className="font-nunito">฿{p.amount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                    />
                  ))}
                </Section>
              )}

              <p className="pt-1 text-center text-xs text-black/30">{t("sec_source")}</p>
            </div>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
}
