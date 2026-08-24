// Coupon schedule derivation — a straight port of src/lib/couponSchedule.ts so a
// bond added from a LINE slip gets exactly the same payout timeline as one added
// in the web app. Keep the two in sync: a divergence would give the same bond a
// different schedule depending on where it was added.

export interface CouponPayout {
  installment: number;
  totalInstallments: number;
  amount: number; // gross THB per coupon, to 2 decimals (satang preserved)
  date: string; // YYYY-MM-DD
}

export interface ScheduleInput {
  issueDate: string | null;
  maturityDate: string | null;
  termYears: number | null;
  frequency: number | null; // coupon payments per year
  couponRate: number | null; // % per year
  faceValue: number;
}

// Frequency hints found in SEC coupon.type / desc_th / name_th text.
const FREQ_PATTERNS: [RegExp, number][] = [
  [/ทุก\s*1\s*เดือน|รายเดือน|monthly/i, 12],
  [/ทุก\s*3\s*เดือน|รายไตรมาส|ไตรมาส|quarter/i, 4],
  [/ทุก\s*6\s*เดือน|ครึ่งปี|semi-?annual|half.?year/i, 2],
  [/ทุก\s*12\s*เดือน|ทุกปี|รายปี|annual|yearly/i, 1],
];

export function parseFrequency(text?: string | null): number | null {
  if (!text) return null;
  for (const [re, f] of FREQ_PATTERNS) if (re.test(text)) return f;
  return null;
}

function parseDate(s: string): Date | null {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function deriveCouponSchedule(input: ScheduleInput): CouponPayout[] {
  const { issueDate, maturityDate, termYears, faceValue } = input;
  // Snapshots occasionally carry the rate as a Thai string ("ร้อยละ 4.50 …");
  // pull the first number out and bail if there isn't one.
  const couponRate =
    typeof input.couponRate === "number"
      ? input.couponRate
      : Number(String(input.couponRate ?? "").match(/[\d.]+/)?.[0]);
  if (!maturityDate || !couponRate || !faceValue) return [];

  const maturity = parseDate(maturityDate);
  if (!maturity) return [];
  const issue = issueDate ? parseDate(issueDate) : null;

  const freq = input.frequency && input.frequency > 0 ? input.frequency : 2;
  const stepMonths = Math.max(1, Math.round(12 / freq));

  // With an issue date we walk the real span; otherwise fall back to term.
  const maxCount = issue ? 800 : Math.max(1, Math.round((termYears ?? 1) * freq));

  // Coupons fall on the maturity day-of-month, stepped back by whole months.
  // Compute each date from month arithmetic (not Date.setMonth) so month-end
  // maturities don't drift (31 Aug → 28/29 Feb, not 2/3 Mar).
  const matY = maturity.getFullYear();
  const matM = maturity.getMonth();
  const matD = maturity.getDate();
  const dates: Date[] = [];
  for (let k = 0; k < 800; k++) {
    const tm = matM - k * stepMonths;
    const y = matY + Math.floor(tm / 12);
    const m = ((tm % 12) + 12) % 12;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const dt = new Date(y, m, Math.min(matD, daysInMonth));
    if (issue) {
      if (dt <= issue) break; // stop before the issue date — no day-one coupon
    } else if (k >= maxCount) {
      break;
    }
    dates.push(dt);
  }
  dates.reverse();

  const total = dates.length;
  // Interest accrues on an actual/365 basis (matches the issuer's 50-ทวิ): each
  // coupon = face × rate × (days in the period / 365), where the period runs
  // from the previous coupon date (or the issue date for the first) to this one.
  // Regular ~6-month periods sum to the flat annual rate; stub first/last
  // periods come out proportionally shorter/longer, as on the real slip.
  const dayMs = 86_400_000;
  const monthShift = (d: Date, months: number): Date => {
    const tm = d.getMonth() + months;
    const y = d.getFullYear() + Math.floor(tm / 12);
    const m = ((tm % 12) + 12) % 12;
    return new Date(y, m, Math.min(d.getDate(), new Date(y, m + 1, 0).getDate()));
  };
  const firstPrev = issue ?? monthShift(dates[0], -stepMonths);
  return dates.map((date, i) => {
    const prev = i === 0 ? firstPrev : dates[i - 1];
    const days = Math.round((date.getTime() - prev.getTime()) / dayMs);
    return {
      installment: i + 1,
      totalInstallments: total,
      amount: Math.round(faceValue * (couponRate / 100) * (days / 365) * 100) / 100,
      date: iso(date),
    };
  });
}
