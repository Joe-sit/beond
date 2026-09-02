// Per-user OCR spend control, shared by the web scan flow (ocr-extract) and the
// LINE slip flow (line-webhook) so the two cannot drift apart.
//
// beond is free, so every scan is a cost with no matching revenue. Two guards:
// a ceiling on how many slips one account can send through the vision model,
// and a memory of images already read so a re-send is free.
//
// Everything here fails OPEN. A quota table that is missing, slow, or broken
// must never stop a user filing their taxes — the worst case of failing open is
// a slightly larger bill; the worst case of failing closed is a product that
// refuses to work.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

/** Slips one account may OCR per rolling window. */
export const SCAN_LIMIT = 60;
/** Length of that window, in days. */
export const SCAN_WINDOW_DAYS = 30;

const day = (d: Date) => d.toISOString().slice(0, 10);
const today = () => day(new Date());
const windowStart = () => day(new Date(Date.now() - (SCAN_WINDOW_DAYS - 1) * 86_400_000));

export interface ScanQuota {
  used: number;
  limit: number;
  remaining: number;
  /** Exempt accounts (users.scan_unlimited) report Infinity-ish, not a number. */
  unlimited: boolean;
  windowDays: number;
}

/** How much of the window this user has spent. */
export async function scanQuota(admin: SupabaseClient, userId: string): Promise<ScanQuota> {
  const base = { limit: SCAN_LIMIT, windowDays: SCAN_WINDOW_DAYS };
  try {
    const { data: u } = await admin.from("users").select("scan_unlimited").eq("id", userId).maybeSingle();
    if (u?.scan_unlimited) return { ...base, used: 0, remaining: SCAN_LIMIT, unlimited: true };

    const { data: rows } = await admin
      .from("scan_usage")
      .select("count")
      .eq("user_id", userId)
      .gte("day", windowStart());
    const used = (rows ?? []).reduce((s, r) => s + (r.count ?? 0), 0);
    return { ...base, used, remaining: Math.max(0, SCAN_LIMIT - used), unlimited: false };
  } catch (e) {
    console.error("scanQuota (fail-open):", (e as Error).message);
    return { ...base, used: 0, remaining: SCAN_LIMIT, unlimited: false };
  }
}

/** True when this user has nothing left in the window. */
export async function scanQuotaExceeded(admin: SupabaseClient, userId: string): Promise<boolean> {
  const q = await scanQuota(admin, userId);
  return !q.unlimited && q.remaining <= 0;
}

/**
 * Count one billable read against the window.
 *
 * Attempts, not successes: an unreadable slip costs exactly what a readable one
 * costs, so charging only for the ones that worked would leave the expensive
 * half of the bill unmetered.
 */
export async function bumpScanQuota(admin: SupabaseClient, userId: string): Promise<void> {
  try {
    const d = today();
    const { data: row } = await admin
      .from("scan_usage").select("count").eq("user_id", userId).eq("day", d).maybeSingle();
    await admin.from("scan_usage").upsert({ user_id: userId, day: d, count: (row?.count ?? 0) + 1 });
  } catch (e) {
    console.error("bumpScanQuota (skip):", (e as Error).message);
  }
}

/** SHA-256 of the image bytes, hex — the key an already-read slip is filed under. */
export async function imageHash(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Fields from a previous read of this exact image, if there was one. */
export async function cachedScan<T>(
  admin: SupabaseClient,
  userId: string,
  hash: string,
): Promise<T | null> {
  try {
    const { data } = await admin
      .from("scan_cache").select("fields").eq("user_id", userId).eq("image_hash", hash).maybeSingle();
    return (data?.fields as T) ?? null;
  } catch (e) {
    console.error("cachedScan (miss):", (e as Error).message);
    return null;
  }
}

/** Remember this read so the same image is never paid for twice. */
export async function rememberScan(
  admin: SupabaseClient,
  userId: string,
  hash: string,
  fields: unknown,
): Promise<void> {
  try {
    await admin.from("scan_cache").upsert({ user_id: userId, image_hash: hash, fields });
  } catch (e) {
    console.error("rememberScan (skip):", (e as Error).message);
  }
}

/** What the user is told when the window is spent. */
export const QUOTA_MESSAGE =
  `สแกนได้สูงสุด ${SCAN_LIMIT} ใบต่อ ${SCAN_WINDOW_DAYS} วัน — ` +
  "ตอนนี้ครบแล้ว ถ้าต้องการเพิ่ม ทักแอดมินได้เลย";
