import { supabase, supabaseEnabled } from "./supabase";

export type ServiceStatus = "up" | "down" | "degraded" | "skipped";

export interface HealthService {
  id: string;
  label: string;
  status: ServiceStatus;
  latencyMs: number | null;
  detail: string;
}

export interface HealthStats {
  users: number;
  users7d: number;
  usersWithHoldings: number;
  usersWithTaxRate: number;
  holdings: number;
  bonds: number;
  payouts: number;
  totalFaceValue: number;
  taxDocs: { pending: number; confirmed: number; rejected: number; total: number; pendingOver24h: number };
  whtConfirmedTotal: number;
  docsBySource: { line: number; web: number };
  ocrSuccessRate: number | null;
  docs24h: number;
  scansToday: number;
  scans7d: number;
}

export interface HealthReport {
  ok: boolean;
  generatedAt: string;
  services: HealthService[];
  stats: HealthStats;
}

export type HealthResult =
  | { kind: "ok"; report: HealthReport }
  | { kind: "forbidden" }
  | { kind: "error"; message: string };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

// Sample report so the admin page is viewable in mock mode (no Supabase) and for
// UI development. Shape matches the `health` edge function exactly.
function mockReport(): HealthReport {
  // Jitter around a baseline so the realtime sparklines have movement in mock mode.
  const j = (base: number, spread: number) => Math.round(base + (Math.random() - 0.5) * spread);
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    services: [
      { id: "db", label: "Supabase DB", status: "up", latencyMs: j(42, 20), detail: "OK" },
      { id: "line", label: "LINE Messaging", status: "up", latencyMs: j(118, 50), detail: "HTTP 200" },
      { id: "sec", label: "SEC API", status: "degraded", latencyMs: j(3120, 600), detail: "HTTP 204" },
      { id: "gemini", label: "Gemini OCR", status: "up", latencyMs: j(210, 90), detail: "HTTP 200" },
      { id: "logodev", label: "logo.dev", status: "up", latencyMs: j(88, 40), detail: "HTTP 200" },
    ],
    stats: {
      users: 128,
      users7d: 11,
      usersWithHoldings: 74,
      usersWithTaxRate: 38,
      holdings: 412,
      bonds: 1840,
      payouts: 3120,
      totalFaceValue: 84_500_000,
      taxDocs: { pending: 9, confirmed: 63, rejected: 4, total: 76, pendingOver24h: 2 },
      whtConfirmedTotal: 512_340,
      docsBySource: { line: 58, web: 18 },
      ocrSuccessRate: 95,
      docs24h: 7,
      scansToday: 14,
      scans7d: 63,
    },
  };
}

export async function fetchHealth(): Promise<HealthResult> {
  // Mock mode (no backend) → sample data so the dashboard is still usable.
  if (!supabaseEnabled || !supabase || !SUPABASE_URL) {
    return { kind: "ok", report: mockReport() };
  }

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { kind: "forbidden" };

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/health`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 403) return { kind: "forbidden" };
    if (!res.ok) return { kind: "error", message: `HTTP ${res.status}` };
    return { kind: "ok", report: (await res.json()) as HealthReport };
  } catch (e) {
    return { kind: "error", message: (e as Error).message };
  }
}
