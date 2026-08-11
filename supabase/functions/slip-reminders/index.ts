// beond — weekly LINE reminder of 50-ทวิ slips still waiting to be collected.
//
// Cron-driven (pg_cron → net.http_post, weekly). For every user with a linked
// LINE account it counts coupon payouts that are already DUE (coupon paid, so a
// 50-ทวิ exists) this tax year but have no matching confirmed slip yet, and pushes
// a nudge — highlighting how many fall in the current month and the year's total
// still outstanding. Users with nothing outstanding are skipped (no spam), and a
// per-user throttle stops a double-send if the job (or a manual test) re-runs.
//
// Auth: guarded by the `x-cron-secret` header (env CRON_SECRET). Optional JSON
// body `{ "userId": "<public_user_id>" }` targets ONE user for testing, and
// `{ "force": true }` bypasses the throttle.
//
// Env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY injected automatically;
//      LINE_MESSAGING_ACCESS_TOKEN + CRON_SECRET set as Edge Function secrets.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LINE_TOKEN = Deno.env.get("LINE_MESSAGING_ACCESS_TOKEN") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const LIFF_ID = Deno.env.get("LIFF_ID") ?? "2010595004-4xF6RZlS";
const LIFF_URL = `https://liff.line.me/${LIFF_ID}`;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const DAY = 86_400_000;
const MATCH_WINDOW = 45 * DAY; // slip pay_date can drift from the scheduled payout
const THROTTLE = 6 * DAY; // don't renotify within ~a week

async function linePush(to: string, messages: unknown[]): Promise<boolean> {
  const r = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LINE_TOKEN}` },
    body: JSON.stringify({ to, messages }),
  });
  if (!r.ok) { console.error(`push ${r.status}: ${await r.text()}`); return false; }
  return true;
}

interface Payout { holding_id: string; payout_date: string; }
interface Doc { symbol: string; payDate: string; }

// Count DUE-but-uncollected payouts for one user, and how many land this month.
// Mirrors the app's matchConfirmedPayouts: a payout is collected when a confirmed
// slip of the same symbol sits within MATCH_WINDOW of it; each slip claims one.
function countUncollected(
  payouts: Payout[],
  holdingSymbol: Map<string, string>,
  docs: Doc[],
  now: number,
  monthStart: number,
  monthEnd: number,
): { total: number; thisMonth: number } {
  // Only payouts already paid (slip issued) — future coupons have no slip yet.
  const due = payouts
    .map((p) => ({ symbol: holdingSymbol.get(p.holding_id) ?? "", t: new Date(p.payout_date).getTime() }))
    .filter((p) => p.symbol && p.t <= now)
    .sort((a, b) => a.t - b.t);

  const claimed = new Array(due.length).fill(false);
  for (const d of docs) {
    const dt = new Date(d.payDate).getTime();
    let best = -1, bestDiff = Infinity;
    for (let i = 0; i < due.length; i++) {
      if (claimed[i] || due[i].symbol !== d.symbol) continue;
      const diff = Math.abs(due[i].t - dt);
      if (diff <= MATCH_WINDOW && diff < bestDiff) { best = i; bestDiff = diff; }
    }
    if (best >= 0) claimed[best] = true;
  }

  let total = 0, thisMonth = 0;
  for (let i = 0; i < due.length; i++) {
    if (claimed[i]) continue;
    total++;
    if (due[i].t >= monthStart && due[i].t <= monthEnd) thisMonth++;
  }
  return { total, thisMonth };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET)
    return json(401, { error: "unauthorized" });
  if (!LINE_TOKEN) return json(500, { error: "LINE token not configured" });

  let body: { userId?: string; force?: boolean } = {};
  try { body = await req.json(); } catch { /* empty body = run for everyone */ }

  const now = Date.now();
  const yearCE = new Date().getFullYear();
  const yearBE = yearCE + 543;
  const yearStart = `${yearCE}-01-01`;
  const yearEnd = `${yearCE}-12-31`;
  const d = new Date();
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).getTime();

  // Users with a linked LINE account (optionally just the test target).
  let uq = admin.from("users").select("id, line_user_id, slip_reminder_sent_at").not("line_user_id", "is", null);
  if (body.userId) uq = uq.eq("id", body.userId);
  const { data: users, error: uErr } = await uq;
  if (uErr) return json(500, { error: uErr.message });
  if (!users?.length) return json(200, { ok: true, pushed: 0, scanned: 0 });

  let pushed = 0;
  for (const u of users) {
    // Throttle: skip anyone reminded within the last ~week (unless forced).
    if (!body.force && u.slip_reminder_sent_at &&
        now - new Date(u.slip_reminder_sent_at as string).getTime() < THROTTLE) continue;

    // This user's holdings → symbol per holding.
    const { data: holdings } = await admin
      .from("holdings")
      .select("id, bonds(symbol)")
      .eq("user_id", u.id);
    if (!holdings?.length) continue;
    const holdingSymbol = new Map<string, string>();
    const holdingIds: string[] = [];
    for (const h of holdings as unknown as { id: string; bonds: { symbol: string } | null }[]) {
      holdingIds.push(h.id);
      if (h.bonds?.symbol) holdingSymbol.set(h.id, h.bonds.symbol);
    }

    // This year's payouts for those holdings.
    const { data: payouts } = await admin
      .from("payouts")
      .select("holding_id, payout_date")
      .in("holding_id", holdingIds)
      .gte("payout_date", yearStart)
      .lte("payout_date", yearEnd);
    if (!payouts?.length) continue;

    // Confirmed slips this year → symbol + pay_date.
    const { data: rawDocs } = await admin
      .from("tax_documents")
      .select("pay_date, bonds(symbol)")
      .eq("user_id", u.id)
      .eq("status", "confirmed");
    const docs: Doc[] = (rawDocs as unknown as { pay_date: string | null; bonds: { symbol: string } | null }[] ?? [])
      .filter((r) => r.pay_date && r.bonds?.symbol)
      .map((r) => ({ symbol: r.bonds!.symbol, payDate: r.pay_date as string }));

    const { total, thisMonth } = countUncollected(
      payouts as Payout[], holdingSymbol, docs, now, monthStart, monthEnd,
    );
    if (total === 0) continue; // nothing outstanding — no nudge

    const lead = thisMonth > 0
      ? `เดือนนี้มี ${thisMonth} ใบที่ต้องสะสม`
      : `มีสลิป 50 ทวิ รอสะสมอยู่`;
    const flex = {
      type: "flex",
      altText: `เหลือ ${total} ใบที่ยังไม่ได้เก็บสลิป 50 ทวิ 📄`,
      contents: {
        type: "bubble",
        body: {
          type: "box", layout: "vertical", spacing: "sm",
          contents: [
            { type: "text", text: "อย่าลืมเก็บสลิป 50 ทวิ 📄", weight: "bold", size: "lg", color: "#43507F" },
            { type: "text", text: lead, size: "sm", color: "#111111", wrap: true, margin: "sm" },
            { type: "text", text: `รวมยังไม่ได้เก็บ ${total} ใบ ปีภาษี ${yearBE}`, size: "xs", color: "#8A8A8A", margin: "sm" },
          ],
        },
        footer: {
          type: "box", layout: "vertical",
          contents: [{
            type: "button", style: "primary", color: "#43507F", height: "sm",
            action: { type: "uri", label: "เก็บสลิปในแอป beond", uri: LIFF_URL },
          }],
        },
      },
    };

    if (await linePush(u.line_user_id as string, [flex])) {
      pushed++;
      await admin.from("users").update({ slip_reminder_sent_at: new Date().toISOString() }).eq("id", u.id);
    }
  }

  return json(200, { ok: true, scanned: users.length, pushed });
});
