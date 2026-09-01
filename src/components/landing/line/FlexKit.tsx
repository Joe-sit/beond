/**
 * The DOM half of beond's LINE Flex vocabulary.
 *
 * The real cards are built server-side in supabase/functions/_shared/flex.ts
 * and rendered by LINE itself. The landing page has to show them inside a
 * phone, so these components mirror that file one for one — same palette, same
 * 5:7 label/value grid, same grey group blocks, same 68px header strip with the
 * illustration bleeding off its right edge. Change a card there, change it
 * here.
 *
 * Flex sizes in px, from LINE's spec: xxs 11, xs 13, sm 14, md 16, xxl 27.
 */
import type { ReactNode } from "react";

/** Mirrors `C` in _shared/flex.ts. */
export const C = {
  brand: "#43507F",
  ink: "#1B1C1D",
  muted: "#9AA0AE",
  green: "#12BC59",
  red: "#D64545",
  soft: "#F5F6F9",
} as const;

const baht = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export const fmtTHB = (n: number) => baht.format(n);

/** Issuer mark. The real card pulls logo.dev; here a monogram keeps the phone
 *  offline and never shows a broken image. */
export function CircleLogo({ symbol, size = 36 }: { symbol: string; size?: number }) {
  const ticker = (symbol.match(/^[A-Za-z]+/)?.[0] ?? symbol).toUpperCase().slice(0, 3);
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border border-black/10 bg-white font-semibold text-[#43507F]"
      style={{ width: size, height: size, fontSize: size * 0.32 }}
    >
      {ticker}
    </div>
  );
}

/** label ⟷ value on the shared 5:7 grid, so every card's values line up. */
export function Kv({
  label,
  value,
  color = C.ink,
  strong = false,
}: {
  label: string;
  value: ReactNode;
  color?: string;
  strong?: boolean;
}) {
  return (
    <div className="mt-[10px] flex items-center gap-2 first:mt-0">
      <span className="flex-[5] text-[13px] leading-tight" style={{ color: C.muted }}>
        {label}
      </span>
      <span
        className="flex-[7] text-right text-[14px] leading-tight"
        style={{ color, fontWeight: strong ? 700 : 400 }}
      >
        {value}
      </span>
    </div>
  );
}

/** A padded grey block — calmer than a hairline under every row. */
export function GroupCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mt-3 rounded-[12px] p-[14px] ${className}`} style={{ backgroundColor: C.soft }}>
      {children}
    </div>
  );
}

/** Coloured 68px strip; the artwork overhangs the body below it. */
export function HeaderStrip({
  title,
  subtitle,
  bg,
  fg,
  art,
}: {
  title: string;
  subtitle?: string;
  bg: string;
  fg: string;
  art?: { file: string; width: number; bottom?: number; end?: number };
}) {
  return (
    <div
      className="relative flex h-[68px] flex-col justify-center px-4"
      style={{ backgroundColor: bg, paddingRight: art ? art.width - 8 : 16 }}
    >
      <span className="text-[16px] leading-tight font-bold" style={{ color: fg }}>
        {title}
      </span>
      {subtitle && (
        <span className="mt-[2px] text-[11px] leading-tight" style={{ color: `${fg}B3` }}>
          {subtitle}
        </span>
      )}
      {art && (
        <img
          src={`/illustration/${art.file}`}
          alt=""
          className="pointer-events-none absolute select-none"
          style={{ width: art.width, right: art.end ?? 0, bottom: art.bottom ?? -10 }}
        />
      )}
    </div>
  );
}

/** A Flex bubble at `size: "mega"` — the width LINE gives it in a 390 chat. */
export function Bubble({ children }: { children: ReactNode }) {
  return (
    <div className="w-[290px] overflow-hidden rounded-[14px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.12)]">
      {children}
    </div>
  );
}

export function BubbleBody({ children }: { children: ReactNode }) {
  return <div className="p-5">{children}</div>;
}

export function BubbleFooter({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1 p-3">{children}</div>;
}

export function PrimaryButton({ children }: { children: ReactNode }) {
  return (
    <span
      className="flex h-[36px] items-center justify-center rounded-[6px] text-[14px] font-bold text-white"
      style={{ backgroundColor: C.brand }}
    >
      {children}
    </span>
  );
}

export function LinkButton({ children, color = C.brand }: { children: ReactNode; color?: string }) {
  return (
    <span
      className="flex h-[36px] items-center justify-center text-[14px] font-bold"
      style={{ color }}
    >
      {children}
    </span>
  );
}
