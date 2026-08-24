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

// Ask DBD for the official name behind a juristic id. null = not found / error.
// DBD sits behind an Imperva WAF that silently drops requests without a
// browser-like User-Agent (a bare Deno UA just hangs until the timeout), so send
// browser headers.
export async function dbdName(id: string): Promise<string | null> {
  try {
    const res = await fetch(`${DBD_URL}/${id}`, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "application/json",
        Referer: "https://openapi.dbd.go.th/",
      },
    });
    if (!res.ok) return null;
    const body = await res.json();
    if (body?.status?.code !== "1000") return null;
    const person = body?.data?.[0]?.["cd:OrganizationJuristicPerson"];
    return (person?.["cd:OrganizationJuristicNameTH"] as string | undefined) ?? null;
  } catch {
    return null;
  }
}
