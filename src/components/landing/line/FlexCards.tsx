/**
 * The five cards beond actually sends, rebuilt as DOM.
 *
 * Each one mirrors a builder in supabase/functions:
 *   ScanResultCard  → line-webhook/index.ts, buildReviewFlex (complete / blocked)
 *   SavedSlipCard   → _shared/savedSlip.ts
 *   AddedBondCard   → _shared/addedBond.ts
 *   BatchSummaryCard→ line-webhook/index.ts, "สรุปทั้งชุด"
 *   CalendarCard    → the interest-calendar carousel, one bubble per month
 *
 * The numbers are a worked example of one investor's year, not data pulled from
 * anywhere — the landing page has no session to read.
 */
import {
  Bubble,
  BubbleBody,
  BubbleFooter,
  C,
  CircleLogo,
  fmtTHB,
  GroupCard,
  HeaderStrip,
  Kv,
  LinkButton,
  PrimaryButton,
} from "./FlexKit";

/** Issuer identity row, shared by every card that names a bond. */
function IssuerRow({ symbol, issuer }: { symbol: string; issuer: string }) {
  return (
    <div className="flex items-center gap-3">
      <CircleLogo symbol={symbol} />
      <div className="min-w-0 flex-1">
        <div className="text-[14px] leading-tight font-bold" style={{ color: C.ink }}>
          {symbol}
        </div>
        <div className="text-[11px] leading-tight" style={{ color: C.muted }}>
          {issuer}
        </div>
      </div>
    </div>
  );
}

/** "อ่านสลิปสำเร็จ" — the review card, the first thing back after a scan. */
export function ScanResultCard() {
  return (
    <Bubble>
      <HeaderStrip
        title="อ่านสลิปสำเร็จ · 1/6"
        subtitle="ตรวจสอบก่อนบันทึกเป็นเครดิตภาษี"
        bg="#E8F0FF"
        fg="#2F3C6B"
        art={{ file: "slip-front.png", width: 96, bottom: -6 }}
      />
      <BubbleBody>
        <p className="text-[13px] leading-snug" style={{ color: C.muted }}>
          ตรวจสอบข้อมูลก่อนบันทึกนะครับ
        </p>
        <GroupCard>
          <IssuerRow symbol="BTSG28OA" issuer="บริษัท บีทีเอส กรุ๊ป โฮลดิ้งส์ จำกัด (มหาชน)" />
          <Kv label="เลขผู้เสียภาษี" value="✓ ตรงกับ DBD" color={C.green} strong />
          <Kv label="วันที่จ่าย" value="7 ส.ค. 2569" />
        </GroupCard>
        <GroupCard>
          <Kv label="ดอกเบี้ย" value="฿23,915.07" />
          <Kv label="ภาษีหัก ณ ที่จ่าย" value="฿3,587.26 (15%)" strong />
          <Kv label="คงเหลือจ่ายจริง" value="฿20,327.81" />
        </GroupCard>
      </BubbleBody>
      <BubbleFooter>
        <PrimaryButton>บันทึกเป็นเครดิตภาษี</PrimaryButton>
        <LinkButton color={C.muted}>แก้ไข</LinkButton>
      </BubbleFooter>
    </Bubble>
  );
}

/** "ยังบันทึกไม่ได้" — the DBD check refusing a slip whose payer id is wrong. */
export function TaxIdMismatchCard() {
  return (
    <Bubble>
      <HeaderStrip
        title="ยังบันทึกไม่ได้ · 4/6"
        subtitle="เลขผู้เสียภาษีไม่ตรงกับผู้ออกหุ้นกู้"
        bg="#FDE8E8"
        fg="#A33131"
        art={{ file: "taxid-error.png", width: 76, bottom: -8, end: 6 }}
      />
      <BubbleBody>
        <p className="text-[13px] leading-snug" style={{ color: C.red }}>
          เลขผู้เสียภาษีของผู้จ่ายไม่ผ่านการตรวจสอบ จึงยังบันทึกให้ไม่ได้
        </p>
        <GroupCard>
          <IssuerRow symbol="ORI288B" issuer="บริษัท ออริจิ้น พร็อพเพอร์ตี้ จำกัด (มหาชน)" />
          <Kv label="เลขผู้เสียภาษี" value="0107556000159" color={C.red} strong />
          <Kv label="จดทะเบียนในชื่อ" value="ออริจิ้น พร็อพเพอร์ตี้ จก. (มหาชน)" />
        </GroupCard>
      </BubbleBody>
      <BubbleFooter>
        <PrimaryButton>เข้าไปแก้ไข</PrimaryButton>
      </BubbleFooter>
    </Bubble>
  );
}

/** "บันทึกสำเร็จ" — leads with the refund, which is the whole point. */
export function SavedSlipCard() {
  return (
    <Bubble>
      <HeaderStrip
        title="บันทึกสำเร็จ"
        subtitle="สะสมสลิปปี 2569 แล้ว 5/10 ใบ"
        bg="#DFF5E3"
        fg="#137A3B"
        art={{ file: "collected-slip.png", width: 104 }}
      />
      <BubbleBody>
        <div className="text-[11px]" style={{ color: C.muted }}>
          คาดว่าจะได้คืนสะสมตอนนี้
        </div>
        <div className="text-[27px] leading-tight font-bold" style={{ color: C.green }}>
          +฿{fmtTHB(8420.55)}
        </div>
        <div className="mt-1 text-[11px]" style={{ color: C.muted }}>
          คำนวณจากฐานภาษี 5% ที่คุณระบุไว้
        </div>
        <GroupCard>
          <IssuerRow symbol="BTSG28OA" issuer="บริษัท บีทีเอส กรุ๊ป โฮลดิ้งส์ จำกัด (มหาชน)" />
          <Kv label="เลขผู้เสียภาษี" value="✓ ตรงกับ DBD" color={C.green} strong />
          <Kv label="งวดที่" value="1/6" />
          <Kv label="วันที่จ่าย" value="7 ส.ค. 2569" />
        </GroupCard>
        <GroupCard>
          <Kv label="เงินได้" value="฿23,915.07" />
          <Kv label="ภาษีหัก ณ ที่จ่าย" value="฿3,587.26" strong />
        </GroupCard>
      </BubbleBody>
      <BubbleFooter>
        <LinkButton>ดูในแอป beond</LinkButton>
      </BubbleFooter>
    </Bubble>
  );
}

/** "เพิ่มเข้าพอร์ตแล้ว" — the position the first slip derived on its own. */
export function AddedBondCard() {
  return (
    <Bubble>
      <HeaderStrip
        title="เพิ่มเข้าพอร์ตแล้ว"
        subtitle="สร้างจากสลิปงวดแรกที่คุณส่งมา"
        bg="#E4F3E8"
        fg="#1F6B42"
        art={{ file: "add-bond.png", width: 92, bottom: -8, end: 4 }}
      />
      <BubbleBody>
        <div className="text-[11px]" style={{ color: C.muted }}>
          เงินลงทุนโดยประมาณ
        </div>
        <div className="text-[27px] leading-tight font-bold" style={{ color: C.ink }}>
          ฿{fmtTHB(1000000)}
        </div>
        <div className="mt-1 text-[11px] leading-snug" style={{ color: C.muted }}>
          คำนวณย้อนจากดอกเบี้ยบนสลิป — แก้ให้ตรงได้ในแอป
        </div>
        <GroupCard>
          <IssuerRow symbol="BTSG28OA" issuer="บริษัท บีทีเอส กรุ๊ป โฮลดิ้งส์ จำกัด (มหาชน)" />
          <Kv label="คูปอง" value="3.6% ต่อปี" />
          <Kv label="จ่ายดอกเบี้ย" value="ทุก 6 เดือน" />
          <Kv label="ครบกำหนด" value="ต.ค. 2571" />
        </GroupCard>
        <GroupCard>
          <Kv label="ดอกเบี้ยทั้งปี (ก่อนภาษี)" value="฿36,000.00" strong />
          <Kv label="หัก ณ ที่จ่าย 15%" value="฿5,400.00" />
        </GroupCard>
      </BubbleBody>
      <BubbleFooter>
        <LinkButton>แก้ไขเงินลงทุน</LinkButton>
      </BubbleFooter>
    </Bubble>
  );
}

/** "สรุปทั้งชุด" — one ack for a batch of slips sent together. */
export function BatchSummaryCard() {
  const rows = [
    { symbol: "BTSG28OA", state: "ok" as const, amount: 3587.26 },
    { symbol: "SIRI267A", state: "ok" as const, amount: 2923.84 },
    { symbol: "BRI275A", state: "ok" as const, amount: 3609.86 },
    { symbol: "ORI288B", state: "bad" as const, amount: 3045.21 },
  ];
  return (
    <Bubble>
      <HeaderStrip
        title="สรุปทั้งชุด"
        subtitle="บันทึกได้ทันที 3 ใบ"
        bg="#E8F0FF"
        fg="#2F3C6B"
        art={{ file: "coins.png", width: 76, bottom: -4, end: 6 }}
      />
      <BubbleBody>
        <p className="text-[13px] leading-snug" style={{ color: C.muted }}>
          อ่านครบ 4 ใบแล้ว — 1 ใบยังติดเลขผู้เสียภาษี
        </p>
        <GroupCard>
          {rows.map((r) => (
            <Kv
              key={r.symbol}
              label={r.symbol}
              value={`${r.state === "ok" ? "✓" : "!"} ฿${fmtTHB(r.amount)}`}
              color={r.state === "ok" ? C.ink : C.red}
              strong={r.state === "bad"}
            />
          ))}
        </GroupCard>
        <GroupCard>
          <Kv label="รวมภาษีหัก ณ ที่จ่าย" value="฿10,120.96" strong />
        </GroupCard>
      </BubbleBody>
      <BubbleFooter>
        <PrimaryButton>บันทึกทั้งหมด</PrimaryButton>
      </BubbleFooter>
    </Bubble>
  );
}

/** The interest calendar: a month per bubble, swiped sideways in the chat. */
export function CalendarCard() {
  const months = [
    { m: "สิงหาคม 2569", due: 2, got: 1, sum: "฿5,380.89" },
    { m: "กันยายน 2569", due: 1, got: 0, sum: "฿2,923.84" },
  ];
  return (
    <div className="flex gap-2">
      {months.map((x) => (
        <div key={x.m} className="w-[240px] shrink-0 overflow-hidden rounded-[14px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.12)]">
          <HeaderStrip
            title={x.m}
            subtitle={`สลิปที่ต้องสะสมของเดือน ${x.due} ใบ`}
            bg="#EEF1FA"
            fg="#2F3C6B"
            art={{ file: "money-bill.png", width: 70, bottom: -6, end: 4 }}
          />
          <div className="p-4">
            <Kv label="ได้รับแล้ว" value={`${x.got}/${x.due} ใบ`} strong />
            <Kv label="ดอกเบี้ยรวม" value={x.sum} />
            <div className="mt-3 h-[6px] overflow-hidden rounded-full bg-black/10">
              <div
                className="h-full rounded-full"
                style={{ width: `${(x.got / x.due) * 100}%`, backgroundColor: C.green }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
