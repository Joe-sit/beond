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

export async function fetchHealth(): Promise<HealthResult> {
  // No backend configured → report the real state (error), never fake stats.
  if (!supabaseEnabled || !supabase || !SUPABASE_URL) {
    return { kind: "error", message: "ยังไม่ได้ตั้งค่า Supabase" };
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
