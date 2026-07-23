import { useCallback, useEffect, useState } from "react";
import {
  IconRefresh,
  IconServer,
  IconUsers,
  IconBriefcase,
  IconReceiptTax,
  IconScan,
  IconLock,
  IconAlertTriangle,
  IconUserCheck,
  IconLibrary,
  IconCalendarDollar,
  IconCoin,
  IconAdjustmentsDollar,
  IconBrandLine,
  IconWorld,
  IconClockExclamation,
  IconDatabasePlus,
  IconUser,
} from "@tabler/icons-react";
import {
  fetchHealth,
  type HealthReport,
  type HealthResult,
  type ServiceStatus,
} from "../lib/health";
import { fetchUncataloguedBonds, type CatalogAuditResult } from "../lib/catalogAudit";

const REFRESH_MS = 20_000;

const STATUS_META: Record<ServiceStatus, { dot: string; text: string; label: string; hex: string }> = {
  up: { dot: "bg-emerald-500", text: "text-emerald-600", label: "ปกติ", hex: "#10B981" },
  degraded: { dot: "bg-amber-500", text: "text-amber-600", label: "ช้า/ผิดปกติ", hex: "#F59E0B" },
  down: { dot: "bg-red-500", text: "text-red-600", label: "ล่ม", hex: "#EF4444" },
  skipped: { dot: "bg-black/25", text: "text-black/40", label: "ไม่ได้ตั้งค่า", hex: "#9CA3AF" },
};

const HISTORY_MAX = 30; // rolling window of samples (~10 min at 20s/poll)

// Realtime latency sparkline for one service. Single series, so no legend/axes —
// the card title names it; stroke carries current status (semantic color). Null
// samples (service skipped) are dropped; needs ≥2 points to draw a line.
function Sparkline({ values, color }: { values: (number | null)[]; color: string }) {
  const w = 132;
  const h = 34;
  const pad = 3;
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  if (pts.length < 2) {
    return <div className="h-8.5 w-33 shrink-0" aria-hidden />;
  }
  const xs = values.length - 1 || 1;
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const span = max - min || 1;
  const x = (i: number) => pad + (i / xs) * (w - 2 * pad);
  const y = (v: number) => h - pad - ((v - min) / span) * (h - 2 * pad);
  const d = pts.map((p, k) => `${k === 0 ? "M" : "L"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} className="shrink-0" role="img" aria-label="latency trend">
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last.i)} cy={y(last.v)} r={3} fill={color} />
    </svg>
  );
}

function fmt(n: number): string {
  return new Intl.NumberFormat("th-TH").format(n);
}

// Compact THB for large money figures (฿84.5M, ฿512.3K).
function fmtBaht(n: number): string {
  if (n >= 1e6) return `฿${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `฿${(n / 1e3).toFixed(1)}K`;
  return `฿${fmt(Math.round(n))}`;
}

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s} วินาทีที่แล้ว`;
  return `${Math.round(s / 60)} นาทีที่แล้ว`;
}

function overall(report: HealthReport): { text: string; cls: string } {
  const live = report.services.filter((s) => s.status !== "skipped");
  if (live.some((s) => s.status === "down"))
    return { text: "มีบริการล่ม", cls: "bg-red-50 text-red-700 border-red-200" };
  if (live.some((s) => s.status === "degraded"))
    return { text: "บางบริการผิดปกติ", cls: "bg-amber-50 text-amber-700 border-amber-200" };
  return { text: "ระบบทำงานปกติ", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

function StatTile({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#E7E7E7] bg-white p-4">
      <div className="flex items-center gap-2 text-[#43507F]">
        {icon}
        <span className="text-xs font-medium text-black/55">{label}</span>
      </div>
      <p className="mt-2 font-nunito text-2xl font-bold text-[#181D20]">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-black/45">{sub}</p>}
    </div>
  );
}

// Report: bonds users hold/added that are missing from bond-catalog.json — the
// list an admin should add to the catalog (usually manual entries too new for
// the SEC feed). Copy button hands the symbols off for a snapshot refresh.
function CatalogGapReport({ audit }: { audit: CatalogAuditResult | null }) {
  if (!audit || audit.kind !== "ok") return null;
  const { bonds } = audit;
  return (
    <>
      <h2 className="mt-6 mb-2 flex items-center gap-1.5 text-sm font-bold text-[#43507F]">
        <IconDatabasePlus size={16} />
        หุ้นกู้ที่ต้องเพิ่มเข้า catalog
        <span className="rounded-full bg-[#43507F]/10 px-2 py-0.5 text-xs font-medium text-[#43507F]">{bonds.length}</span>
      </h2>
      <div className="overflow-hidden rounded-2xl border border-[#E7E7E7] bg-white">
        {bonds.length === 0 ? (
          <p className="p-5 text-center text-sm text-black/45">
            catalog ครบ — ไม่มีหุ้นกู้ที่ผู้ใช้ถือ/เพิ่มแล้วหายไปจาก snapshot
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-[#E7E7E7] px-4 py-2">
              <span className="text-xs text-black/45">
                หุ้นกู้ในฐานข้อมูลที่ไม่มีใน <code>bond-catalog.json</code> — รัน <code>npm run fetch:bonds</code> ถ้า SEC ลงแล้ว
              </span>
              <button
                onClick={() => navigator.clipboard?.writeText(bonds.map((b) => b.symbol).join(", "))}
                className="shrink-0 rounded-lg border border-[#E7E7E7] px-2.5 py-1 text-xs font-medium text-black/60 hover:bg-black/5"
              >
                คัดลอกรหัส
              </button>
            </div>
            <ul className="divide-y divide-[#F0F0F0]">
              {bonds.map((b) => (
                <li key={b.symbol} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="font-nunito text-sm font-bold text-[#181D20]">{b.symbol}</p>
                    <p className="truncate text-xs text-black/50">{b.issuer}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-right">
                    <span className="text-xs text-black/45">ครบกำหนด {b.maturityDate ?? "—"}</span>
                    <span className="flex items-center gap-1 text-xs font-medium text-[#43507F]">
                      <IconUser size={13} />
                      {b.holders}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}

export default function AdminDashboard() {
  const [result, setResult] = useState<HealthResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [audit, setAudit] = useState<CatalogAuditResult | null>(null);
  // Rolling latency history per service id, appended each poll for the sparklines.
  const [history, setHistory] = useState<Record<string, (number | null)[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [res, auditRes] = await Promise.all([fetchHealth(), fetchUncataloguedBonds()]);
    setResult(res);
    setAudit(auditRes);
    if (res.kind === "ok") {
      setHistory((prev) => {
        const next: Record<string, (number | null)[]> = { ...prev };
        for (const s of res.report.services) {
          next[s.id] = [...(prev[s.id] ?? []), s.latencyMs].slice(-HISTORY_MAX);
        }
        return next;
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="min-h-screen bg-[#F6F4F1] px-5 py-6">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <IconServer size={22} className="text-[#43507F]" />
            <h1 className="text-lg font-bold text-[#43507F]">beond · System Health</h1>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-[#E7E7E7] bg-white px-3 py-1.5 text-xs font-medium text-black/60 disabled:opacity-60"
          >
            <IconRefresh size={14} className={loading ? "animate-spin" : ""} />
            รีเฟรช
          </button>
        </div>

        {/* Forbidden */}
        {result?.kind === "forbidden" && (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-[#E7E7E7] bg-white p-5">
            <IconLock size={22} className="text-black/40" />
            <div>
              <p className="text-sm font-bold text-[#181D20]">ไม่มีสิทธิ์เข้าถึง</p>
              <p className="text-xs text-black/50">หน้านี้สำหรับผู้ดูแลระบบ (admin) เท่านั้น</p>
            </div>
          </div>
        )}

        {/* Error */}
        {result?.kind === "error" && (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-5">
            <IconAlertTriangle size={22} className="text-red-500" />
            <div>
              <p className="text-sm font-bold text-red-700">โหลดข้อมูลไม่ได้</p>
              <p className="text-xs text-red-600">{result.message}</p>
            </div>
          </div>
        )}

        {/* Loading skeleton (first load only) */}
        {!result && loading && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-black/5" />
            ))}
          </div>
        )}

        {result?.kind === "ok" && (
          <>
            {/* Overall banner + timestamp */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
              <span
                className={`rounded-full border px-3 py-1 text-sm font-bold ${overall(result.report).cls}`}
              >
                {overall(result.report).text}
              </span>
              <span className="text-xs text-black/45">
                อัปเดต {timeAgo(result.report.generatedAt)} · รีเฟรชอัตโนมัติทุก 20 วิ
              </span>
            </div>

            {/* Services */}
            <h2 className="mt-6 mb-2 text-sm font-bold text-[#43507F]">บริการ / Dependencies</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {result.report.services.map((s) => {
                const m = STATUS_META[s.status];
                return (
                  <div key={s.id} className="rounded-2xl border border-[#E7E7E7] bg-white p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-[#181D20]">{s.label}</span>
                      <span className={`flex items-center gap-1.5 text-xs font-medium ${m.text}`}>
                        <span className={`h-2 w-2 rounded-full ${m.dot}`} />
                        {m.label}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-baseline gap-1.5 text-xs text-black/45">
                        <span className="font-nunito text-sm font-bold text-[#181D20]">
                          {s.latencyMs === null ? "—" : `${s.latencyMs}`}
                        </span>
                        <span>{s.latencyMs === null ? s.detail : "ms"}</span>
                      </div>
                      <Sparkline values={history[s.id] ?? []} color={m.hex} />
                    </div>
                  </div>
                );
              })}
            </div>

            {(() => {
              const st = result.report.stats;
              return (
                <>
                  {/* Users */}
                  <h2 className="mt-6 mb-2 text-sm font-bold text-[#43507F]">ผู้ใช้</h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatTile icon={<IconUsers size={16} />} label="ผู้ใช้ทั้งหมด" value={fmt(st.users)} sub={`+${fmt(st.users7d)} ใน 7 วัน`} />
                    <StatTile icon={<IconUserCheck size={16} />} label="มีหุ้นกู้ในพอร์ต" value={fmt(st.usersWithHoldings)} sub={st.users ? `${Math.round((st.usersWithHoldings / st.users) * 100)}% ของผู้ใช้` : undefined} />
                    <StatTile icon={<IconAdjustmentsDollar size={16} />} label="ตั้งฐานภาษีแล้ว" value={fmt(st.usersWithTaxRate)} />
                    <StatTile icon={<IconScan size={16} />} label="สแกนวันนี้" value={fmt(st.scansToday)} sub={`7 วัน ${fmt(st.scans7d)} ครั้ง`} />
                  </div>

                  {/* Portfolio + catalog */}
                  <h2 className="mt-6 mb-2 text-sm font-bold text-[#43507F]">พอร์ต & แคตตาล็อก</h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatTile icon={<IconBriefcase size={16} />} label="หุ้นกู้ที่ถือ (holdings)" value={fmt(st.holdings)} />
                    <StatTile icon={<IconCoin size={16} />} label="มูลค่าหน้าตั๋วรวม" value={fmtBaht(st.totalFaceValue)} />
                    <StatTile icon={<IconLibrary size={16} />} label="แคตตาล็อกหุ้นกู้" value={fmt(st.bonds)} />
                    <StatTile icon={<IconCalendarDollar size={16} />} label="งวดดอกเบี้ย (payouts)" value={fmt(st.payouts)} />
                  </div>

                  {/* Tax / OCR pipeline */}
                  <h2 className="mt-6 mb-2 text-sm font-bold text-[#43507F]">ภาษี & OCR</h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatTile icon={<IconReceiptTax size={16} />} label="เครดิตภาษีรวม (confirmed)" value={fmtBaht(st.whtConfirmedTotal)} />
                    <StatTile icon={<IconScan size={16} />} label="OCR สำเร็จ" value={st.ocrSuccessRate === null ? "—" : `${st.ocrSuccessRate}%`} sub={`${fmt(st.docs24h)} สลิปใน 24 ชม.`} />
                    <StatTile icon={<IconReceiptTax size={16} />} label="สลิปทั้งหมด" value={fmt(st.taxDocs.total)} sub={`ยืนยัน ${fmt(st.taxDocs.confirmed)} · ปฏิเสธ ${fmt(st.taxDocs.rejected)}`} />
                    <StatTile icon={<IconClockExclamation size={16} />} label="รอยืนยัน" value={fmt(st.taxDocs.pending)} sub={st.taxDocs.pendingOver24h > 0 ? `⚠ ค้าง >24 ชม. ${fmt(st.taxDocs.pendingOver24h)}` : "ไม่มีค้างนาน"} />
                    <StatTile icon={<IconBrandLine size={16} />} label="จาก LINE OCR" value={fmt(st.docsBySource.line)} />
                    <StatTile icon={<IconWorld size={16} />} label="จาก Web / จดเอง" value={fmt(st.docsBySource.web)} />
                  </div>
                </>
              );
            })()}

            {/* Bonds held/added but missing from the catalog snapshot. */}
            <CatalogGapReport audit={audit} />
          </>
        )}
      </div>
    </div>
  );
}
