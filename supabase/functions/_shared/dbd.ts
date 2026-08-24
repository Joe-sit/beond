// DBD (Department of Business Development) — the official juristic-person
// registry. Shared by verify-tax-id (the app's own check) and line-webhook, so
// a slip scanned in chat is held to exactly the same standard as one typed in
// the app. Mirrors src/lib/verifyTaxId.ts on the client.

const DBD_URL = "https://openapi.dbd.go.th/api/v1/juristic_person";

// Reduce a Thai company name to a comparable core: drop the legal wrappers
// (บริษัท / จำกัด / มหาชน / company / limited / public), punctuation, spaces.
export function normName(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/\(?\s*มหาชน\s*\)?/g, "")
    .replace(/บริษัท|จำกัด|ห้างหุ้นส่วน|public|company|limited|co\.?|ltd\.?|plc\.?/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function namesMatch(a: string, b: string): boolean {
  const x = normName(a);
  const y = normName(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

/**
 * A DBD answer, with "the registry says no such company" kept distinct from "we
 * couldn't ask". Collapsing the two (the old `string | null`) made a timeout
 * look exactly like a bad tax id, so the same number reported ไม่พบ or พบ
 * depending on how DBD felt that second.
 */
export type DbdResult =
  | { status: "found"; name: string }
  | { status: "not_found" }
  | { status: "error" };

// DBD sits behind an Imperva WAF that silently drops requests without a
// browser-like User-Agent (a bare Deno UA just hangs until the timeout), so send
// browser headers.
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  Accept: "application/json",
  Referer: "https://openapi.dbd.go.th/",
};

async function attempt(id: string, timeoutMs: number): Promise<DbdResult> {
  try {
    const res = await fetch(`${DBD_URL}/${id}`, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: BROWSER_HEADERS,
    });
    // 4xx that isn't 404 is still the registry answering — but 429/5xx are the
    // WAF or an outage, which must not read as "this company doesn't exist".
    if (res.status === 429 || res.status >= 500) return { status: "error" };
    if (!res.ok) return res.status === 404 ? { status: "not_found" } : { status: "error" };

    const body = await res.json();
    // 1000 = OK. Anything else is DBD refusing rather than reporting absence,
    // except its own "not found" code (1001).
    const code = body?.status?.code;
    if (code === "1001") return { status: "not_found" };
    if (code !== "1000") return { status: "error" };

    const person = body?.data?.[0]?.["cd:OrganizationJuristicPerson"];
    const name = person?.["cd:OrganizationJuristicNameTH"] as string | undefined;
    return name ? { status: "found", name } : { status: "not_found" };
  } catch {
    // Timeout / DNS / connection reset — we never reached an answer.
    return { status: "error" };
  }
}

/**
 * Look up the official name behind a juristic id. Retries once on a transport
 * failure: DBD drops requests often enough that a single miss is normal, and a
 * user watching the field shouldn't be told their correct tax id is unknown.
 */
export async function dbdLookup(id: string): Promise<DbdResult> {
  const first = await attempt(id, 8000);
  if (first.status !== "error") return first;
  await new Promise((r) => setTimeout(r, 400));
  return await attempt(id, 8000);
}

/** Back-compat shim: name on success, null for both "not found" and "error". */
export async function dbdName(id: string): Promise<string | null> {
  const r = await dbdLookup(id);
  return r.status === "found" ? r.name : null;
}
