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
// Don't renotify within this window. Kept comfortably under the weekly cron's
// 7-day gap so a mid-week manual test can't swallow the next scheduled run.
const THROTTLE = 4 * DAY;

async function linePush(to: string, messages: unknown[]): Promise<boolean> {
  const r = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LINE_TOKEN}` },
    body: JSON.stringify({ to, messages }),
  });
  if (!r.ok) { console.error(`push ${r.status}: ${await r.text()}`); return false; }
  return true;
}

interface Payout { holding_id: string; payout_date: string; installment: number; amount: number; }
interface Doc { symbol: string; payDate: string; }
interface HoldingMeta { symbol: string; total: number; } // total = bond's total installments
interface Uncollected { symbol: string; installment: number; total: number; amount: number; thisMonth: boolean; }

const fmtTHB = (n: number) => new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2 }).format(n);

// The user's uncollected coupons (each carries its bond series, installment, and
// coupon amount so the reminder can spell them out). Mirrors the app's
// matchConfirmedPayouts: a payout is collected when a confirmed slip of the same
// symbol sits within MATCH_WINDOW of it; each slip claims one.
function getUncollected(
  payouts: Payout[],
  holdingMeta: Map<string, HoldingMeta>,
  docs: Doc[],
  monthStart: number,
  monthEnd: number,
): Uncollected[] {
  // Payouts whose coupon month has ARRIVED (payout_date on/before the end of the
  // current month) — its 50-ทวิ exists to collect. Future months' coupons have no
  // slip yet, so they're excluded. Matches the app's per-month folder, which lists
  // this month's coupons as "to collect" for the whole month (not gated on the
  // exact day within it).
  const due = payouts
    .map((p) => {
      const meta = holdingMeta.get(p.holding_id);
      return meta ? { ...meta, installment: p.installment, amount: p.amount, t: new Date(p.payout_date).getTime() } : null;
    })
    .filter((p): p is HoldingMeta & { installment: number; amount: number; t: number } => !!p && p.t <= monthEnd)
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

  const out: Uncollected[] = [];
  for (let i = 0; i < due.length; i++) {
    if (claimed[i]) continue;
    out.push({
      symbol: due[i].symbol,
      installment: due[i].installment,
      total: due[i].total,
      amount: due[i].amount,
      thisMonth: due[i].t >= monthStart && due[i].t <= monthEnd,
    });
  }
  return out;
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
  const yearStart = `${yearCE}-01-01`;
  const yearEnd = `${yearCE}-12-31`;
  const d = new Date();
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).getTime();

  // Users with a linked LINE account who haven't opted out (optionally just the
  // test target).
  let uq = admin.from("users")
    .select("id, line_user_id, slip_reminder_sent_at")
    .not("line_user_id", "is", null)
    .eq("slip_reminder_enabled", true)
    .or("line_friend.is.null,line_friend.eq.true"); // skip users who blocked the OA
  if (body.userId) uq = uq.eq("id", body.userId);
  const { data: users, error: uErr } = await uq;
  if (uErr) return json(500, { error: uErr.message });
  if (!users?.length) return json(200, { ok: true, pushed: 0, scanned: 0 });

  let pushed = 0;
  for (const u of users) {
    // Throttle: skip anyone reminded within the last THROTTLE window (unless forced).
    if (!body.force && u.slip_reminder_sent_at &&
        now - new Date(u.slip_reminder_sent_at as string).getTime() < THROTTLE) continue;

    // This user's holdings → bond series + total installments per holding.
    const { data: holdings } = await admin
      .from("holdings")
      .select("id, bonds(symbol, total_installments)")
      .eq("user_id", u.id);
    if (!holdings?.length) continue;
    const holdingMeta = new Map<string, HoldingMeta>();
    const holdingIds: string[] = [];
    for (const h of holdings as unknown as { id: string; bonds: { symbol: string; total_installments: number } | null }[]) {
      holdingIds.push(h.id);
      if (h.bonds?.symbol) holdingMeta.set(h.id, { symbol: h.bonds.symbol, total: h.bonds.total_installments });
    }

    // This year's payouts for those holdings (installment + coupon amount).
    const { data: payouts } = await admin
      .from("payouts")
      .select("holding_id, payout_date, installment, amount")
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

    const items = getUncollected(payouts as Payout[], holdingMeta, docs, monthStart, monthEnd);
    if (items.length === 0) continue; // nothing outstanding — no nudge

    const total = items.length;
    const monthItems = items.filter((it) => it.thisMonth);
    // List the coupons to act on — this month's first; cap so a big batch stays
    // readable, with a "+N" tail.
    const listSrc = monthItems.length ? monthItems : items;
    const LIST_CAP = 5;
    const shown = listSrc.slice(0, LIST_CAP);
    const moreCount = listSrc.length - shown.length;

    const lead = monthItems.length > 0
      ? `เดือนนี้มี ${monthItems.length} ใบที่ต้องส่งสลิป`
      : `มีสลิป 50 ทวิ รอส่งอยู่`;

    // One row per coupon: bond series + installment, and the coupon it pays.
    const rows = shown.map((it) => ({
      type: "box", layout: "vertical", spacing: "none", margin: "md",
      contents: [
        { type: "text", text: `${it.symbol} · งวดที่ ${it.installment}/${it.total}`, size: "sm", weight: "bold", color: "#111111", wrap: true },
        { type: "text", text: `ดอกเบี้ยที่จะได้รับ ฿${fmtTHB(it.amount)}`, size: "xs", color: "#8A8A8A" },
      ],
    }));
    if (moreCount > 0) {
      rows.push({
        type: "box", layout: "vertical", spacing: "none", margin: "md",
        contents: [{ type: "text", text: `และอีก ${moreCount} ใบ`, size: "xs", color: "#8A8A8A", wrap: true }],
      } as unknown as typeof rows[number]);
    }

    const flex = {
      type: "flex",
      altText: `${lead} — ถ่ายรูปสลิป 50 ทวิ ส่งเข้าแชทได้เลย 📄`,
      contents: {
        type: "bubble",
        body: {
          type: "box", layout: "vertical", spacing: "sm",
          contents: [
            { type: "text", text: "ถึงเวลาส่งสลิป 50 ทวิ 📄", weight: "bold", size: "lg", color: "#43507F" },
            { type: "text", text: lead, size: "sm", color: "#111111", wrap: true, margin: "sm" },
            { type: "separator", margin: "md" },
            ...rows,
            { type: "separator", margin: "md" },
            { type: "text", text: "ถ่ายรูปสลิป 50 ทวิ ส่งเข้าแชทนี้ได้เลย เดี๋ยว beond อ่านให้อัตโนมัติ", size: "xs", color: "#8A8A8A", wrap: true, margin: "md" },
          ],
        },
      },
      // Quick-reply camera actions open the phone camera / gallery straight in the
      // chat, so the user snaps and sends the slip photo without leaving LINE.
      quickReply: {
        items: [
          { type: "action", action: { type: "camera", label: "📷 ถ่ายรูปสลิป" } },
          { type: "action", action: { type: "cameraRoll", label: "🖼️ เลือกรูปสลิป" } },
          { type: "action", action: { type: "uri", label: "ดูในแอป beond", uri: LIFF_URL } },
        ],
      },
    };

    if (await linePush(u.line_user_id as string, [flex])) {
      pushed++;
      await admin.from("users").update({ slip_reminder_sent_at: new Date().toISOString() }).eq("id", u.id);
    }
  }

  return json(200, { ok: true, scanned: users.length, pushed });
});
