import { useEffect, useState } from "react";
import { toast } from "@heroui/react";
import {
  IconBell,
  IconBrandLine,
  IconChevronRight,
  IconLogout,
  IconShieldLock,
} from "@tabler/icons-react";
import { useT, useLang, setLang } from "../../lib/i18n";
import { getSlipReminderEnabled, saveSlipReminderEnabled, getLineFriend } from "../../lib/userSettings";
import { getFriendFlag, LINE_OA_ADD_URL, type AuthProfile } from "../../lib/auth";

// User settings page (sidebar "ตั้งค่า"). Three sections: Profile (read-only LINE
// identity + OA link status), Notifications (weekly slip-reminder opt-out), and
// Account (language + privacy + logout). All writes persist per-user in the DB.
export default function SettingsView({
  profile,
  onLogout,
}: {
  profile: AuthProfile;
  onLogout?: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const [remind, setRemind] = useState<boolean | null>(null); // null = still loading
  const [savingRemind, setSavingRemind] = useState(false);
  const [friend, setFriend] = useState<boolean | null>(null); // null = unknown (non-LIFF)

  useEffect(() => {
    let alive = true;
    getSlipReminderEnabled().then((v) => { if (alive) setRemind(v); });
    // DB status (webhook-driven) is authoritative; fall back to the live LIFF
    // snapshot when the DB has never seen a follow/unfollow for this user.
    (async () => {
      const db = await getLineFriend();
      const v = db !== null ? db : await getFriendFlag();
      if (alive) setFriend(v);
    })();
    return () => { alive = false; };
  }, []);

  // Optimistic toggle: flip immediately, roll back on save failure.
  const toggleRemind = async (v: boolean) => {
    const prev = remind;
    setRemind(v);
    setSavingRemind(true);
    const res = await saveSlipReminderEnabled(v);
    setSavingRemind(false);
    if (!res.ok) {
      setRemind(prev ?? !v);
      toast.danger(res.error ?? t("settings_save_error"));
      return;
    }
    toast.success(t("settings_saved"));
  };

  const initial = profile.displayName?.slice(0, 1) ?? "b";

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-y-auto rounded-3xl bg-white p-10">
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <p className="text-sm text-ink/60">{t("settings_label")}</p>
          <h2 className="text-2xl font-medium leading-snug text-ink">{t("nav_settings")}</h2>
        </div>

        {/* ── Profile ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink/40">{t("set_profile")}</p>
          <div className="flex flex-col gap-1 rounded-2xl border border-black/6 p-4">
            <div className="flex items-center gap-4">
              {profile.pictureUrl ? (
                <img src={profile.pictureUrl} alt="" className="size-14 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#43507F]/10 text-xl font-medium text-[#43507F]">
                  {initial}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-lg font-medium text-ink">{profile.displayName}</p>
                <p className="text-sm text-ink/50">{t("beond_account")}</p>
              </div>
            </div>

            {/* OA link status — LINE push (slip reminders) only reaches friends. */}
            {friend !== null && (
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-black/6 pt-3">
                <span className="flex items-center gap-2 text-sm text-ink/70">
                  <IconBrandLine size={20} className="text-[#06C755]" />
                  {friend ? t("set_line_connected") : t("set_line_not_friend")}
                </span>
                {friend ? (
                  <span className="text-sm font-medium text-[#12BC59]">✓</span>
                ) : (
                  <a
                    href={LINE_OA_ADD_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-[#06C755] px-4 py-1.5 text-sm font-medium text-white transition hover:bg-[#05b34c]"
                  >
                    {t("set_add_friend")}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Notifications ───────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink/40">{t("set_notifications")}</p>
          <div className="rounded-2xl border border-black/6 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <IconBell size={20} className="mt-0.5 shrink-0 text-ink/50" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{t("set_notify_weekly")}</p>
                  <p className="text-sm text-ink/50">{t("set_notify_weekly_desc")}</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={remind ?? false}
                aria-label={t("set_notify_weekly")}
                disabled={remind === null || savingRemind}
                onClick={() => toggleRemind(!(remind ?? false))}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${remind ? "bg-[#12BC59]" : "bg-black/15"}`}
              >
                <span
                  className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${remind ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>
            {/* If not a friend, the reminder can't be delivered — nudge to add. */}
            {friend === false && (
              <p className="mt-3 border-t border-black/6 pt-3 text-xs text-[#B4690E]">
                {t("set_notify_needs_friend")}
              </p>
            )}
          </div>
        </div>

        {/* ── Account ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink/40">{t("set_account")}</p>
          <div className="flex flex-col divide-y divide-black/6 rounded-2xl border border-black/6">
            {/* Language */}
            <div className="flex items-center justify-between gap-4 p-4">
              <span className="text-sm font-medium text-ink">{t("set_language")}</span>
              <div className="flex rounded-2xl bg-black/5 p-1 text-sm font-medium">
                {(["th", "en"] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`rounded-xl px-4 py-1.5 transition ${lang === l ? "bg-white text-ink shadow-sm" : "text-ink/50 hover:text-ink"}`}
                  >
                    {l === "th" ? "ไทย" : "EN"}
                  </button>
                ))}
              </div>
            </div>

            {/* Privacy policy — page TBD (backlog); disabled placeholder. */}
            <button
              disabled
              title={t("coming_soon")}
              className="flex items-center justify-between gap-4 p-4 text-left disabled:cursor-not-allowed"
            >
              <span className="flex items-center gap-3 text-sm font-medium text-ink/40">
                <IconShieldLock size={20} className="text-ink/40" />
                {t("set_privacy")}
              </span>
              <IconChevronRight size={18} className="text-ink/30" />
            </button>

            {/* Logout */}
            <button
              onClick={onLogout}
              className="flex items-center gap-3 p-4 text-left text-sm font-medium text-[#D93A3A] transition hover:bg-[#D93A3A]/5"
            >
              <IconLogout size={20} />
              {t("logout")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
