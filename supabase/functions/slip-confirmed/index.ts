// beond — push a "slip collected" confirmation to the user's LINE chat after
// they confirm a 50-ทวิ slip on the web (the LINE deep-link review flow). The
// chat has no reply on a web confirm, so this closes the loop: it tells the user
// the credit was saved, in the same channel the slip arrived on.
//
// Only the owner of the document may trigger its notification (checked against
// the caller's public_user_id), and only a slip that is actually `confirmed` is
// announced — so a replayed request can't spam a chat.
//
// Env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY injected automatically;
//      LINE_MESSAGING_ACCESS_TOKEN set as an Edge Function secret (shared with
//      the line-webhook function).

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LINE_TOKEN = Deno.env.get("LINE_MESSAGING_ACCESS_TOKEN") ?? "";
const LIFF_ID = Deno.env.get("LIFF_ID") ?? "2010595004-4xF6RZlS";
const LIFF_URL = `https://liff.line.me/${LIFF_ID}`;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const fmtTHB = (n: number | null) =>
  n === null ? "-" : new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2 }).format(n);

async function linePush(to: string, messages: unknown[]): Promise<void> {
  const r = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LINE_TOKEN}` },
    body: JSON.stringify({ to, messages }),
  });
  if (!r.ok) console.error(`push ${r.status}: ${await r.text()}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  // Require a valid session; the notification is scoped to the caller's own doc.
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json(401, { error: "unauthenticated" });
  const { data: auth, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !auth.user) return json(401, { error: "unauthenticated" });
  const publicUserId = auth.user.app_metadata?.public_user_id as string | undefined;
  if (!publicUserId) return json(403, { error: "no user" });

  let body: { documentId?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid JSON" });
  }
  const id = (body.documentId ?? "").trim();
  if (!id) return json(400, { error: "documentId required" });

  // Load the doc + confirm ownership + status. Only a confirmed slip owned by the
  // caller is announced — anything else is a silent no-op (never an error the
  // client must handle).
  const { data: doc } = await admin
    .from("tax_documents")
    .select("user_id, status, bond_id, gross_amount, wht_amount, pay_date")
    .eq("id", id)
    .maybeSingle();
  if (!doc || doc.user_id !== publicUserId || doc.status !== "confirmed") {
    return json(200, { ok: true, pushed: false });
  }

  // Resolve the user's LINE id + the bond symbol for a friendly message.
  const { data: user } = await admin
    .from("users").select("line_user_id").eq("id", doc.user_id).maybeSingle();
  const lineUserId = user?.line_user_id as string | undefined;
  if (!lineUserId || !LINE_TOKEN) return json(200, { ok: true, pushed: false });

  let symbol = "หุ้นกู้";
  if (doc.bond_id) {
    const { data: bond } = await admin.from("bonds").select("symbol").eq("id", doc.bond_id).maybeSingle();
    if (bond?.symbol) symbol = bond.symbol as string;
  }

  const wht = doc.wht_amount as number | null;
  const flex = {
    type: "flex",
    altText: "เก็บสลิป 50 ทวิ เข้าเครดิตภาษีแล้ว ✅",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: "เก็บสลิปเรียบร้อย ✅", weight: "bold", size: "lg", color: "#12BC59" },
          {
            type: "text",
            text: `บันทึก ${symbol} เป็นเครดิตภาษีหัก ณ ที่จ่ายแล้ว`,
            size: "sm",
            color: "#111111",
            wrap: true,
            margin: "sm",
          },
          ...(wht !== null
            ? [{ type: "text", text: `ภาษีหัก ณ ที่จ่าย ฿${fmtTHB(wht)}`, size: "xs", color: "#8A8A8A", margin: "sm" }]
            : []),
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#43507F",
            height: "sm",
            action: { type: "uri", label: "ดูสรุปในแอป beond", uri: LIFF_URL },
          },
        ],
      },
    },
  };

  await linePush(lineUserId, [flex]);
  return json(200, { ok: true, pushed: true });
});
