import { supabase, supabaseEnabled } from "./supabase";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

export interface VerifyResult {
  verified: boolean;
  officialName: string | null;
  reason: "match" | "name_mismatch" | "not_found" | "error";
}

// Reduce a Thai company name to a comparable core (mirrors the edge function),
// so the client can decide the live badge without a write.
export function normCompanyName(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/\(?\s*มหาชน\s*\)?/g, "")
    .replace(/บริษัท|จำกัด|ห้างหุ้นส่วน|public|company|limited|co\.?|ltd\.?|plc\.?/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function companyNamesMatch(a: string, b: string): boolean {
  const x = normCompanyName(a);
  const y = normCompanyName(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

// Lookup-only: DBD's official name for a 13-digit id (no write, no trust). For
// live UI feedback while typing. null = not found / error.
export async function lookupTaxIdName(taxId: string): Promise<string | null> {
  const digits = taxId.replace(/\D/g, "");
  if (digits.length !== 13 || !supabaseEnabled || !supabase || !SUPABASE_URL) return null;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-tax-id`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ taxId: digits, lookupOnly: true }),
    });
    if (!res.ok) return null;
    const out = (await res.json()) as VerifyResult;
    return out.officialName;
  } catch {
    return null;
  }
}

// Verify a 13-digit payer tax id against DBD via the edge function. On a match
// the function writes the id to the shared catalog as verified (issuer-wide);
// on a mismatch nothing is written — the caller keeps the raw value locally.
export async function verifyTaxId(taxId: string, issuer: string, symbol: string): Promise<VerifyResult> {
  const digits = taxId.replace(/\D/g, "");
  if (digits.length !== 13) return { verified: false, officialName: null, reason: "error" };
  if (!supabaseEnabled || !supabase || !SUPABASE_URL) {
    return { verified: false, officialName: null, reason: "error" };
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { verified: false, officialName: null, reason: "error" };
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-tax-id`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ taxId: digits, issuer, symbol }),
    });
    if (!res.ok) return { verified: false, officialName: null, reason: "error" };
    return (await res.json()) as VerifyResult;
  } catch {
    return { verified: false, officialName: null, reason: "error" };
  }
}
