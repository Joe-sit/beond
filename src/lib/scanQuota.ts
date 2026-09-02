import { useCallback, useEffect, useState } from "react";
import { supabase, supabaseEnabled } from "./supabase";

/**
 * How many slips the account may still send through OCR.
 *
 * beond is free, and reading a slip costs real money, so there is a ceiling per
 * account. Showing what is left turns that from something a user runs into
 * without warning into something they can see coming — and the wording invites
 * them to ask for more rather than treating the limit as final.
 *
 * The figure comes from the ocr-extract function, which is the thing that
 * actually enforces it; a number computed separately in the client would only
 * ever be a second opinion.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

export interface ScanQuota {
  used: number;
  limit: number;
  remaining: number;
  unlimited: boolean;
  windowDays: number;
}

export async function fetchScanQuota(): Promise<ScanQuota | null> {
  if (!supabaseEnabled || !supabase || !SUPABASE_URL) return null;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/ocr-extract`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const body = await res.json();
  return (body.quota as ScanQuota) ?? null;
}

/** The live figure, plus a `refresh` to call after a scan spends one. */
export function useScanQuota(): { quota: ScanQuota | null; refresh: () => void } {
  const [quota, setQuota] = useState<ScanQuota | null>(null);

  const refresh = useCallback(() => {
    let alive = true;
    fetchScanQuota()
      .then((q) => {
        if (alive) setQuota(q);
      })
      .catch(() => {
        /* a missing figure just means the chip is not shown */
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => refresh(), [refresh]);
  return { quota, refresh };
}
