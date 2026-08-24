// The "added to your portfolio" card, sent when a first slip pulls a bond into
// the portfolio on its own (see autoHolding.ts).
//
// The position size here was derived, not entered, so the card's job is to make
// that legible: it states the figure, says where it came from, and puts editing
// one tap away — rather than quietly presenting a guess as fact.

import { C, circleLogo, fmtTHB, groupCard, headerStrip, kv, thMonth } from "./flex.ts";
import type { BondFacts } from "./autoHolding.ts";

export function buildAddedBondFlex(
  facts: BondFacts,
  faceValue: number,
  installments: number,
  liffUrl: string,
): unknown {
  const freq = facts.frequency && facts.frequency > 0 ? facts.frequency : 2;
  const logo = circleLogo(facts.symbol);
  const annual = facts.couponRate ? (faceValue * facts.couponRate) / 100 : null;
  const maturity = facts.maturityDate ? new Date(facts.maturityDate) : null;
  const freqLabel = freq === 12 ? "ทุกเดือน" : freq === 4 ? "ทุกไตรมาส" : freq === 1 ? "ปีละครั้ง" : "ทุก 6 เดือน";

  const identity = {
    type: "box",
    layout: "horizontal",
    spacing: "md",
    alignItems: "center",
    contents: [
      ...(logo ? [logo] : []),
      {
        type: "box",
        layout: "vertical",
        spacing: "none",
        flex: 1,
        contents: [
          { type: "text", text: facts.symbol, size: "sm", weight: "bold", color: C.ink },
          { type: "text", text: facts.issuer, size: "xxs", color: C.muted, wrap: true },
        ],
      },
    ],
  };

  return {
    type: "flex",
    altText: `เพิ่ม ${facts.symbol} เข้าพอร์ตให้แล้ว`,
    contents: {
      type: "bubble",
      size: "mega",
      header: headerStrip({
        title: "เพิ่มเข้าพอร์ตแล้ว",
        subtitle: "สร้างจากสลิปงวดแรกที่คุณส่งมา",
        bg: "#E4F3E8",
        fg: "#1F6B42",
        art: { file: "add-bond.png", ratio: "536:468", width: 92, offsetBottom: "-8px", offsetEnd: "4px" },
      }),
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "20px",
        spacing: "none",
        contents: [
          { type: "text", text: "เงินลงทุนโดยประมาณ", size: "xxs", color: C.muted },
          { type: "text", text: `฿${fmtTHB(faceValue)}`, size: "xxl", weight: "bold", color: C.ink },
          {
            type: "text",
            text: "คำนวณย้อนจากดอกเบี้ยบนสลิป — แก้ให้ตรงได้ในแอป",
            size: "xxs",
            color: C.muted,
            margin: "xs",
            wrap: true,
          },
          groupCard(
            [
              identity,
              ...(facts.couponRate ? [kv("คูปอง", `${facts.couponRate}% ต่อปี`)] : []),
              kv("จ่ายดอกเบี้ย", freqLabel),
              ...(installments ? [kv("จำนวนงวด", `${installments} งวด`)] : []),
              ...(maturity ? [kv("ครบกำหนด", `${thMonth(maturity)} ${maturity.getFullYear() + 543}`)] : []),
            ],
            "lg",
          ),
          ...(annual
            ? [
                groupCard([
                  kv("ดอกเบี้ยทั้งปี (ก่อนภาษี)", `฿${fmtTHB(annual)}`, { strong: true }),
                  // 15% is the flat rate withheld on bond interest — the whole
                  // reason the slips are worth collecting.
                  kv("หัก ณ ที่จ่าย 15%", `฿${fmtTHB(annual * 0.15)}`),
                ]),
              ]
            : []),
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
            action: { type: "uri", label: "แก้ไขเงินลงทุน", uri: liffUrl },
          },
        ],
      },
    },
  };
}
