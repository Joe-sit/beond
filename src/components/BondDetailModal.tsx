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

// Flat label/value row — same style as the confirm page's detail table.
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-6 border-b border-black/10 py-3">
      <span className="w-40 shrink-0 whitespace-nowrap text-base text-black/60">{label}</span>
      <span className="min-w-0 text-base text-black">{value}</span>
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

  // Coupon-schedule chart axis (same treatment as the confirm page).
  const maxAmt = Math.max(1, ...schedule.map((p) => p.amount));
  const axisTop = Math.max(500, Math.ceil(maxAmt / 500) * 500);
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((f) => Math.round(axisTop * f));

  if (!candidate) return null;

  const rows: [string, React.ReactNode][] = [
    [t("company_name"), issuer],
    [t("coupon_rate"), couponRate != null ? `${couponRate}%` : detail?.couponRateText ?? "—"],
    [t("pays_interest"), FREQ_LABEL[freq] ?? "—"],
    [t("rating"), rating || "—"],
    [t("redeem_term"), fmtTerm(detail?.termYears ?? candidate.termYears ?? null, detail?.termMonth ?? null, detail?.termDay ?? null)],
    [t("issue_date"), fmtThaiDate(detail?.issueDate ?? candidate.issueDate)],
    [t("maturity"), fmtThaiDate(detail?.maturityDate ?? candidate.maturityDate)],
    [t("security_kind"), detail?.securityType ?? "—"],
    [t("secured_kind"), detail?.secured ?? "—"],
    [t("subordination"), detail?.subordinated ?? "—"],
    [t("call_option"), detail?.embeddedOption ?? "—"],
    [t("repayment"), detail?.redemption ?? "—"],
    [t("investor_class"), detail?.offerType ?? "—"],
    [t("min_unit"), fmtBaht(detail?.unit ?? null)],
    [t("issue_size"), fmtBaht(detail?.offerValue ?? null)],
    [t("currency"), detail?.currency ?? "—"],
    [t("subscription_period"), detail?.sellingBegin ? `${fmtThaiDate(detail.sellingBegin)} – ${fmtThaiDate(detail.sellingClose)}` : "—"],
    ["ISIN", <span className="font-nunito">{detail?.isin || candidate.isin || "—"}</span>],
  ];

  return (
    <Modal isOpen={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <ModalBackdrop isDismissable>
        <ModalContainer placement="center">
          <ModalDialog className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-3xl bg-white p-6">
            <button
              type="button"
              aria-label={t("close")}
              onClick={onClose}
              className="absolute right-4 top-4 z-10 shrink-0 rounded-full p-2 text-black/40 transition hover:bg-black/5"
            >
              <IconX size={20} />
            </button>

            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pr-1">
              {/* Symbol + badges */}
              <div className="flex flex-col gap-2 pr-8">
                <p className="text-2xl font-medium text-black">{sym}</p>
                <div className="flex flex-wrap gap-2">
                  {rating && (
                    <span className="rounded-full bg-[#E7F5EC] px-3 py-1 font-nunito text-xs font-medium text-[#2E8B57]">{t("rating")} {rating}</span>
                  )}
                  {detail?.offerAbbr && (
                    <span className="rounded-full bg-[#EEF2F8] px-3 py-1 text-xs font-medium text-brand-blue">{detail.offerAbbr}</span>
                  )}
                  {detail?.esgType && (
                    <span className="rounded-full bg-[#E7F5EC] px-3 py-1 text-xs font-medium text-[#2E8B57]">ESG · {detail.esgType}</span>
                  )}
                  {loading && (
                    <span className="flex items-center gap-1 text-xs text-black/40"><IconLoader2 size={14} className="animate-spin" /> {t("loading")}</span>
                  )}
                </div>
              </div>

              {/* Logo + detail table */}
              <div className="flex items-start gap-4">
                <IssuerLogo symbol={sym} name={issuer} size={120} className="rounded-[2.5rem]!" />
                <div className="min-w-0 flex-1">
                  {rows.map(([label, value]) => (
                    <DetailRow key={label} label={label} value={value} />
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
                    <div className="flex h-40 shrink-0 flex-col justify-between text-right font-nunito text-[10px] text-black/40">
                      {ticks.map((v) => (
                        <span key={v} className="leading-none">{v.toLocaleString("th-TH")}</span>
                      ))}
                    </div>
                    <div className="min-w-0 flex-1 overflow-x-auto">
                      <div className="relative h-40">
                        {ticks.map((v, i) => (
                          <div key={v} className="absolute inset-x-0 border-t border-black/10" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }} />
                        ))}
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

              <p className="text-center text-xs text-black/30">{t("sec_source")}</p>
            </div>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
}
