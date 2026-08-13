import { supabase, supabaseEnabled } from "./supabase";

// Per-user app preferences kept on the `users` row (distinct from taxSettings,
// which owns the tax-bracket/income math). Each getter returns a sensible default
// when logged out / mock so the UI never blocks.

// Whether the user wants the weekly LINE reminder of uncollected 50-ทวิ slips.
// Defaults to true (opt-out) — matches the column default.
export async function getSlipReminderEnabled(): Promise<boolean> {
  if (!supabaseEnabled || !supabase) return true;
  const { data: sess } = await supabase.auth.getSession();
  const userId = sess.session?.user.app_metadata?.public_user_id as string | undefined;
  if (!userId) return true;
  const { data } = await supabase
    .from("users").select("slip_reminder_enabled").eq("id", userId).maybeSingle();
  const v = data?.slip_reminder_enabled;
  return v === null || v === undefined ? true : Boolean(v);
}

// Persist the weekly-reminder preference.
export async function saveSlipReminderEnabled(enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  if (!supabaseEnabled || !supabase) return { ok: true };
  const { data: sess } = await supabase.auth.getSession();
  const userId = sess.session?.user.app_metadata?.public_user_id as string | undefined;
  if (!userId) return { ok: false, error: "ยังไม่ได้เข้าสู่ระบบ" };
  const { error } = await supabase
    .from("users").update({ slip_reminder_enabled: enabled }).eq("id", userId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
