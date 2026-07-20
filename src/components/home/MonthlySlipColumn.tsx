import { useMemo } from "react";
import { IconCircleCheck } from "@tabler/icons-react";
import { Table } from "@heroui/react";
import { useTimeline, useViewedYear, useTaxCredits, useJustConfirmed, matchConfirmedPayouts, currentTaxYearBE } from "../../hooks/usePortfolio";
import { issuerName } from "../../lib/issuerLogo";
import IssuerLogo from "../IssuerLogo";

const THAI_MONTH_INDEX: Record<string, number> = {
  มกราคม: 0, กุมภาพันธ์: 1, มีนาคม: 2, เมษายน: 3, พฤษภาคม: 4, มิถุนายน: 5,
  กรกฎาคม: 6, สิงหาคม: 7, กันยายน: 8, ตุลาคม: 9, พฤศจิกายน: 10, ธันวาคม: 11,
};
const fmtTHB = (n: number) => new Intl.NumberFormat("th-TH").format(Math.round(n));

interface MonthRow {
  id: string;
  month: string;
  monthIdx: number;
  yearCE: number;
  expectedWht: number;
  actualNet: number;
  remaining: number;
  issuers: { symbol: string; issuer: string }[];
  slips: number;
  payoutIds: string[];
}

// Monthly slip tracker as a table: one row per month that has coupons, showing
// WHT, net actually paid, the issuers involved, and how many 50-ทวิ slips are
// still unconfirmed.
export default function MonthlySlipColumn() {
  const { months: timeline } = useTimeline();
  const viewed = useViewedYear();
  const { docs } = useTaxCredits();
  const justConfirmed = useJustConfirmed(timeline, docs);

  const rows: MonthRow[] = useMemo(() => {
    const years = [...new Set(timeline.map((m) => m.year))].sort();
    const year = viewed && years.includes(viewed) ? viewed : String(currentTaxYearBE());
    const matched = matchConfirmedPayouts(timeline, docs);
    const out: MonthRow[] = [];
    for (const m of timeline.filter((mm) => mm.year === year && mm.payouts.length > 0)) {
      const monthIdx = THAI_MONTH_INDEX[m.month] ?? -1;
      const yearCE = Number(m.year) - 543;
      const confirmedPayouts = m.payouts.filter((p) => matched.has(p.id));
      out.push({
        id: m.id,
        month: m.month,
        monthIdx,
        yearCE,
        expectedWht: m.payouts.reduce((s, p) => s + Math.round(p.amount * 0.15), 0),
        actualNet: confirmedPayouts.reduce((s, p) => {
          const d = matched.get(p.id)!;
          return s + ((d.grossAmount ?? 0) - (d.whtAmount ?? 0));
        }, 0),
        remaining: Math.max(0, m.payouts.length - confirmedPayouts.length),
        issuers: [...new Map(m.payouts.map((p) => [p.symbol, { symbol: p.symbol, issuer: p.issuer }])).values()],
        slips: m.payouts.length,
        payoutIds: m.payouts.map((p) => p.id),
      });
    }
    return out;
  }, [timeline, viewed, docs]);

  if (!rows.length) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-3xl border border-dashed border-[#43507F]/20 bg-white/40 p-8 text-center text-sm text-black/50">
        ปีนี้ยังไม่มีกำหนดรับดอกเบี้ย
      </div>
    );
  }

  const th = "px-4 py-3 text-left text-sm font-medium text-ink-soft outline-none";
  const td = "px-4 py-3 align-middle text-ink outline-none";

  return (
    <div className="overflow-hidden rounded-3xl bg-card">
      <Table aria-label="สรุปสลิปรายเดือน" className="w-full">
        <Table.Content className="w-full border-collapse">
          <Table.Header className="border-b border-line">
            <Table.Column isRowHeader className={th}>เดือน</Table.Column>
            <Table.Column className={th}>ผู้ออก</Table.Column>
            <Table.Column className={`${th} text-right`}>ยอดหักภาษี ณ ที่จ่าย</Table.Column>
            <Table.Column className={`${th} text-right`}>คงเหลือจ่ายจริง</Table.Column>
            <Table.Column className={`${th} text-right`}>สถานะ</Table.Column>
          </Table.Header>
          <Table.Body items={rows}>
            {(r) => {
              const done = r.remaining === 0;
              const fresh = r.payoutIds.some((id) => justConfirmed.has(id));
              return (
                <Table.Row className={`border-b border-line/60 last:border-0 transition-colors data-hovered:bg-brand/3 ${fresh ? "animate-confirm-glow" : ""}`}>
                  <Table.Cell className={`${td} font-bold`}>{r.month}</Table.Cell>
                  <Table.Cell className={td}>
                    <div className="flex items-center">
                      {r.issuers.slice(0, 4).map((b, i) => (
                        <span key={b.symbol} style={{ marginLeft: i ? -12 : 0, zIndex: i }} className="rounded-full ring-2 ring-white">
                          <IssuerLogo symbol={b.symbol} name={issuerName(b.symbol, b.issuer)} size={30} />
                        </span>
                      ))}
                    </div>
                  </Table.Cell>
                  <Table.Cell className={`${td} text-right font-nunito font-bold`}>฿{fmtTHB(r.expectedWht)}</Table.Cell>
                  <Table.Cell className={`${td} text-right font-nunito font-bold`}>฿{fmtTHB(r.actualNet)}</Table.Cell>
                  <Table.Cell className={`${td} text-right`}>
                    {done ? (
                      <span className="inline-flex items-center gap-1 rounded-xl bg-success/10 px-2.5 py-1 text-sm font-medium text-success">
                        <IconCircleCheck size={14} /> ครบแล้ว
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-xl bg-brand/5 px-2.5 py-1 text-sm font-medium text-brand">
                        รอยืนยัน <span className="mx-0.5 font-nunito">{r.remaining}</span> ใบ
                      </span>
                    )}
                  </Table.Cell>
                </Table.Row>
              );
            }}
          </Table.Body>
        </Table.Content>
      </Table>
    </div>
  );
}
