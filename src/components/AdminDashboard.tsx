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
} from "@tabler/icons-react";
import {
  fetchHealth,
  type HealthReport,
  type HealthResult,
  type ServiceStatus,
} from "../lib/health";

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

export default function AdminDashboard() {
  const [result, setResult] = useState<HealthResult | null>(null);
  const [loading, setLoading] = useState(false);
  // Rolling latency history per service id, appended each poll for the sparklines.
  const [history, setHistory] = useState<Record<string, (number | null)[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchHealth();
    setResult(res);
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

            {/* Metrics */}
            <h2 className="mt-6 mb-2 text-sm font-bold text-[#43507F]">ตัวเลขภาพรวม</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatTile
                icon={<IconUsers size={16} />}
                label="ผู้ใช้ทั้งหมด"
                value={fmt(result.report.stats.users)}
                sub={`+${fmt(result.report.stats.users7d)} ใน 7 วัน`}
              />
              <StatTile
                icon={<IconBriefcase size={16} />}
                label="หุ้นกู้ที่ track"
                value={fmt(result.report.stats.holdings)}
              />
              <StatTile
                icon={<IconScan size={16} />}
                label="OCR สำเร็จ"
                value={
                  result.report.stats.ocrSuccessRate === null
                    ? "—"
                    : `${result.report.stats.ocrSuccessRate}%`
                }
                sub={`${fmt(result.report.stats.docs24h)} สลิปใน 24 ชม.`}
              />
              <StatTile
                icon={<IconReceiptTax size={16} />}
                label="สลิปทั้งหมด"
                value={fmt(result.report.stats.taxDocs.total)}
              />
              <StatTile
                icon={<IconReceiptTax size={16} />}
                label="รอยืนยัน"
                value={fmt(result.report.stats.taxDocs.pending)}
                sub={`ยืนยันแล้ว ${fmt(result.report.stats.taxDocs.confirmed)}`}
              />
              <StatTile
                icon={<IconReceiptTax size={16} />}
                label="ถูกปฏิเสธ"
                value={fmt(result.report.stats.taxDocs.rejected)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
