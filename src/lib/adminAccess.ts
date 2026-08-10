import { useEffect, useState } from "react";
import { supabase } from "./supabase";

// Client-side admin allowlist — the caller's LINE user id must be in
// VITE_ADMIN_LINE_IDS (comma-separated, same value as the server ADMIN_LINE_IDS).
// This only gates UI (showing the Admin link); every admin endpoint re-checks
// the allowlist server-side, so this is convenience, not the security boundary.
const ADMIN_LINE_IDS = (import.meta.env.VITE_ADMIN_LINE_IDS as string | undefined ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!supabase || ADMIN_LINE_IDS.length === 0) return;
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      const lineId =
        (u?.app_metadata?.line_user_id as string | undefined) ??
        (u?.user_metadata?.line_user_id as string | undefined) ??
        null;
      if (alive && lineId && ADMIN_LINE_IDS.includes(lineId)) setIsAdmin(true);
    });
    return () => { alive = false; };
  }, []);
  return isAdmin;
}
