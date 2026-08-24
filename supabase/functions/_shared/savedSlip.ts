// The "slip saved" card, shared by both confirm paths: the postback in chat
// (line-webhook) and the web review screen (slip-confirmed). Same card either
// way, so the chat history reads consistently however the user confirmed.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { C, circleLogo, fmtTHB, groupCard, headerStrip, kv, thDate } from "./flex.ts";

interface DocRow {
  bond_id: string | null;
  payer_name: string | null;
  gross_amount: number | null;
  wht_amount: number | null;
  pay_date: string | null;
  payer_tax_id_verified: boolean | null;
}

interface Stats {
  /** Confirmed slips this calendar year. */
  collected: number;
  /** Coupons the portfolio expects this year — the denominator of "5/12 ใบ". */
  expected: number;
  /** Withheld so far this year. */
  whtYtd: number;
  /** Interest income so far this year. */
  grossYtd: number;
  /** users.marginal_tax_rate, or null when the user hasn't set a bracket. */
  rate: number | null;
}

async function loadStats(admin: SupabaseClient, userId: string, year: number): Promise<Stats> {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  const [{ data: docs }, { data: user }, { data: holdings }] = await Promise.all([
    admin
      .from("tax_documents")
      .select("gross_amount, wht_amount")
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .gte("pay_date", from)
      .lte("pay_date", to),
    admin.from("users").select("marginal_tax_rate").eq("id", userId).maybeSingle(),
    admin.from("holdings").select("id").eq("user_id", userId),
  ]);

  const rows = (docs ?? []) as { gross_amount: number | null; wht_amount: number | null }[];
  const holdingIds = ((holdings ?? []) as { id: string }[]).map((h) => h.id);

  let expected = 0;
  if (holdingIds.length) {
    const { count } = await admin
      .from("payouts")
      .select("id", { count: "exact", head: true })
      .in("holding_id", holdingIds)
      .gte("payout_date", from)
      .lte("payout_date", to);
    expected = count ?? 0;
  }

  return {
    collected: rows.length,
    expected,
    whtYtd: rows.reduce((s, r) => s + Number(r.wht_amount ?? 0), 0),
    grossYtd: rows.reduce((s, r) => s + Number(r.gross_amount ?? 0), 0),
    rate: (user?.marginal_tax_rate as number | null) ?? null,
  };
}

/**
 * Refund the user can expect on what they've collected so far: bond interest is
 * withheld at a flat 15%, so anyone whose bracket is below that has overpaid the
 * difference. Null when no bracket is set (we refuse to guess one) or when the
 * bracket is at/above 15% — there's nothing to claim back.
 */
function refundSoFar(s: Stats): number | null {
  if (s.rate === null || s.grossYtd <= 0) return null;
  const owed = s.grossYtd * (s.rate / 100);
  const refund = s.whtYtd - owed;
  return refund > 0 ? Math.round(refund * 100) / 100 : null;
}

export async function buildSavedFlex(
  admin: SupabaseClient,
  userId: string,
  documentId: string,
  liffUrl: string,
): Promise<unknown> {
  const { data } = await admin
    .from("tax_documents")
    .select("bond_id, payer_name, gross_amount, wht_amount, pay_date, payer_tax_id_verified")
    .eq("id", documentId)
    .maybeSingle();
  const doc = (data ?? {}) as DocRow;

  let symbol: string | null = null;
  let installment: string | null = null;
  if (doc.bond_id) {
    const { data: bond } = await admin
      .from("bonds").select("symbol, total_installments").eq("id", doc.bond_id).maybeSingle();
    symbol = (bond?.symbol as string | null) ?? null;
    // Which coupon of the bond's life this is — matched on the payout date the
    // slip carries, so it only appears when the coupon is actually in the plan.
    if (doc.pay_date && bond?.total_installments) {
      const { data: payout } = await admin
        .from("payouts")
        .select("installment, holdings!inner(user_id)")
        .eq("holdings.user_id", userId)
        .eq("payout_date", doc.pay_date)
        .limit(1)
        .maybeSingle();
      const n = (payout as { installment?: number } | null)?.installment;
      if (n) installment = `${n}/${bond.total_installments}`;
    }
  }

  const year = doc.pay_date ? new Date(doc.pay_date).getFullYear() : new Date().getFullYear();
  const stats = await loadStats(admin, userId, year);
  const refund = refundSoFar(stats);
  const beYear = year + 543;

  const head: Record<string, unknown>[] = refund !== null
    ? [
        { type: "text", text: "คาดว่าจะได้คืนสะสมตอนนี้", size: "xxs", color: C.muted },
        { type: "text", text: `+฿${fmtTHB(refund)}`, size: "xxl", weight: "bold", color: C.green },
        {
          type: "text",
          text: `คำนวณจากฐานภาษี ${stats.rate}% ที่คุณระบุไว้`,
          size: "xxs",
          color: C.muted,
          margin: "xs",
        },
      ]
    : [
        // No bracket set → no number is honest here, so ask for the one input
        // that unlocks it instead of showing a guess.
        { type: "text", text: `ภาษีหัก ณ ที่จ่ายสะสมปี ${beYear}`, size: "xxs", color: C.muted },
        { type: "text", text: `฿${fmtTHB(stats.whtYtd)}`, size: "xxl", weight: "bold", color: C.ink },
        {
          type: "text",
          text: "ระบุฐานภาษีในแอป เพื่อดูว่าจะขอคืนได้เท่าไหร่",
          size: "xxs",
          color: C.brand,
          margin: "xs",
          wrap: true,
        },
      ];

  const identity: unknown[] = [
    {
      type: "box",
      layout: "horizontal",
      spacing: "md",
      alignItems: "center",
      contents: [
        ...(symbol ? [circleLogo(symbol)].filter(Boolean) : []),
        {
          type: "box",
          layout: "vertical",
          spacing: "none",
          flex: 1,
          contents: [
            { type: "text", text: symbol ?? "หุ้นกู้", size: "sm", weight: "bold", color: C.ink },
            { type: "text", text: doc.payer_name ?? "-", size: "xxs", color: C.muted, wrap: true },
          ],
        },
      ],
    },
    doc.payer_tax_id_verified
      ? kv("เลขผู้เสียภาษี", "✓ ตรงกับ DBD", { color: C.green, strong: true })
      : kv("เลขผู้เสียภาษี", "ยังไม่ได้ตรวจสอบ", { color: C.muted }),
    ...(installment ? [kv("งวดที่", installment)] : []),
    kv("วันที่จ่าย", thDate(doc.pay_date)),
  ];

  return {
    type: "flex",
    altText: "บันทึกสลิป 50 ทวิ เข้าเครดิตภาษีแล้ว",
    contents: {
      type: "bubble",
      size: "mega",
      header: headerStrip({
        title: "บันทึกสำเร็จ",
        subtitle: stats.expected
          ? `สะสมสลิปปี ${beYear} แล้ว ${stats.collected}/${stats.expected} ใบ`
          : `สะสมสลิปปี ${beYear} แล้ว ${stats.collected} ใบ`,
        bg: "#DFF5E3",
        fg: "#137A3B",
        art: { file: "collected-slip.png", ratio: "726:488", width: 104 },
      }),
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "20px",
        spacing: "none",
        contents: [
          ...head,
          groupCard(identity, "lg"),
          groupCard([
            kv("เงินได้", `฿${fmtTHB(doc.gross_amount)}`),
            kv("ภาษีหัก ณ ที่จ่าย", `฿${fmtTHB(doc.wht_amount)}`, { strong: true }),
          ]),
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "12px",
        contents: [
          {
            type: "button",
            style: "link",
            height: "sm",
            color: C.brand,
            action: { type: "uri", label: "ดูในแอป beond", uri: liffUrl },
          },
        ],
      },
    },
  };
}
