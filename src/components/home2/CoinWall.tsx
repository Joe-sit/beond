import { IconCheck } from "@tabler/icons-react";
import Token3D from "./Token3D";

export interface CoinItem {
  id: string;
  symbol: string;
  issuer: string; // issuer name (for per-bond grouping in the yearly summary)
  monthLabel: string; // short Thai month of the payout (e.g. "ม.ค.")
  collected: boolean; // has a confirmed slip matched to this payout
  wht: number; // tax credit the coin is worth
}

const fmtTHB = (n: number) =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const COIN = 64; // coin diameter (Figma 1090:3505)

// A row of the year's slips for one bond, rendered as the SAME 3D coin used at
// the home "x ใบ" tokens. Collected = the spinning Token3D + a green ✓ badge;
// not-yet-collected = a dashed outline circle (matches the Figma dotted coin).
// Only collected coins mount a WebGL canvas (Token3D), so a wall of mostly-empty
// slots stays cheap.
export default function CoinWall({
  coins,
  showValue = true,
  onSelect,
}: {
  coins: CoinItem[];
  showValue?: boolean;
  onSelect?: (c: CoinItem) => void;
}) {
  if (!coins.length) {
    return <p className="px-4 py-8 text-center text-sm text-ink/40">ยังไม่มีดอกเบี้ยในปีนี้</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {coins.map((c) => (
        // Calendar-style slot: coin on top, month abbreviation labelled below.
        <div
          key={c.id}
          className="flex flex-col items-center gap-1.5 rounded-2xl border border-black/5 bg-white/60 px-2 py-2.5"
          style={{ width: COIN + 20 }}
        >
          {c.collected ? (
            <button
              type="button"
              onClick={() => onSelect?.(c)}
              className="relative rounded-full transition hover:scale-105"
              style={{ width: COIN, height: COIN }}
            >
              <Token3D symbol={c.symbol} size={COIN} />
              <span className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-[#3FA35B] text-white ring-2 ring-white">
                <IconCheck size={12} />
              </span>
            </button>
          ) : (
            <div
              className="flex items-center justify-center rounded-full border-2 border-dashed border-black/15"
              style={{ width: COIN, height: COIN }}
            />
          )}
          <span className={`text-xs ${c.collected ? "text-ink/70" : "text-ink/35"}`}>{c.monthLabel}</span>
          {showValue && (
            <span className={`whitespace-nowrap font-nunito text-[10px] ${c.collected ? "text-ink/70" : "text-ink/35"}`}>
              ฿{fmtTHB(c.wht)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
