import { supabase, supabaseEnabled } from "./supabase";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

export interface CatalogItem {
  symbol: string;
  nameTh?: string;
  nameEn?: string;
  isin?: string;
  issuer?: string;
  couponRate?: number | null;
  maturityDate?: string | null;
  issueDate?: string | null;
  termYears?: number | null;
  frequency?: number | null;
  source?: string;
}

export interface CatalogFile {
  at?: number;
  items: CatalogItem[];
}

export interface CatalogDiff {
  total: number;
  added: string[];
  removed: string[];
}

export type ImportResult =
  | { kind: "ok"; count: number }
  | { kind: "forbidden" }
  | { kind: "error"; message: string };

// Parse + validate an uploaded catalog file. Throws with a readable message so
// the admin sees exactly why a file was rejected.
export function parseCatalogFile(text: string): CatalogFile {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error("ไฟล์ไม่ใช่ JSON ที่ถูกต้อง");
  }
  const items = (body as CatalogFile)?.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("ต้องมี `items` เป็น array และไม่ว่าง (ไฟล์จาก npm run fetch:bonds)");
  }
  if (!items.every((it) => it && typeof it.symbol === "string" && it.symbol.length > 0)) {
    throw new Error("ทุกรายการต้องมี `symbol` เป็น string");
  }
  return { at: (body as CatalogFile).at, items };
}

// Symbols currently served (Storage snapshot first, then the bundled file), so
// the admin can preview what an upload adds/removes before committing.
async function currentSymbols(): Promise<Set<string>> {
  const sources = [
    SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/catalog/bond-catalog.json` : null,
    "/bond-catalog.json",
  ].filter((u): u is string => !!u);
  for (const src of sources) {
    try {
      const res = await fetch(src, { cache: "no-cache" });
      if (!res.ok) continue;
      const body = (await res.json()) as CatalogFile | null;
      if (body?.items?.length) return new Set(body.items.map((i) => i.symbol));
    } catch {
      /* next source */
    }
  }
  return new Set();
}

export async function diffCatalog(next: CatalogItem[]): Promise<CatalogDiff> {
  const before = await currentSymbols();
  const nextSet = new Set(next.map((i) => i.symbol));
  return {
    total: next.length,
    added: [...nextSet].filter((s) => !before.has(s)).sort(),
    removed: [...before].filter((s) => !nextSet.has(s)).sort(),
  };
}

// Send the validated catalog to the admin-gated edge function, which stores it.
export async function importCatalog(items: CatalogItem[]): Promise<ImportResult> {
  if (!supabaseEnabled || !supabase || !SUPABASE_URL) {
    return { kind: "error", message: "ยังไม่ได้ตั้งค่า Supabase" };
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { kind: "forbidden" };
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/catalog-import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (res.status === 403) return { kind: "forbidden" };
    if (!res.ok) {
      const msg = await res.json().catch(() => null);
      return { kind: "error", message: msg?.error ?? `HTTP ${res.status}` };
    }
    const out = (await res.json()) as { count: number };
    return { kind: "ok", count: out.count };
  } catch (e) {
    return { kind: "error", message: (e as Error).message };
  }
}
