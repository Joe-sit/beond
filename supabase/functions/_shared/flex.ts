// Shared building blocks for beond's LINE Flex messages, so the scan summary,
// the saved-slip card and the interest calendar read as one product rather than
// three separate designs.
//
// Env:
//   LOGODEV_TOKEN — logo.dev publishable key (same value as the app's
//                   VITE_LOGODEV_TOKEN). Absent → issuer logos are skipped.
//   APP_ORIGIN    — where the illustrations are served from (public/illustration).

import { ISSUER_DOMAINS } from "./issuerDomains.ts";

const LOGODEV_TOKEN = Deno.env.get("LOGODEV_TOKEN") ?? "";
export const APP_ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://beond-dashboard.vercel.app";
export const ART = `${APP_ORIGIN}/illustration`;

export const C = {
  brand: "#43507F",
  ink: "#1B1C1D",
  muted: "#9AA0AE",
  green: "#12BC59",
  red: "#D64545",
  hair: "#0000000F",
  soft: "#F5F6F9",
} as const;

export const fmtTHB = (n: number | null | undefined): string =>
  n === null || n === undefined
    ? "-"
    : new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const TH_MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
export const TH_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

export const thMonth = (d: Date, full = false): string =>
  full ? TH_MONTHS_FULL[d.getMonth()] : TH_MONTHS_SHORT[d.getMonth()];

/** Thai-style short date: 7 ส.ค. 2569. */
export function thDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.getDate()} ${TH_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;
}

// Bond symbols are ISSUER_TICKER + numbers + optional series letters
// (BRI267A → BRI). Mirrors issuerTicker in src/lib/issuerLogo.ts.
export const issuerTicker = (symbol: string): string =>
  (symbol.match(/^[A-Za-z]+/)?.[0] ?? symbol).toUpperCase();

// logo.dev by mapped domain, else by ticker. `fallback=monogram` (not the app's
// 404) because a failed image in Flex renders as a broken box with no way to
// swap in a monogram of our own.
export function logoUrl(symbol: string): string | null {
  if (!LOGODEV_TOKEN) return null;
  const ticker = issuerTicker(symbol);
  const path = ISSUER_DOMAINS[ticker] ?? `ticker/${ticker}`;
  return `https://img.logo.dev/${path}?token=${LOGODEV_TOKEN}&size=160&format=png&retina=true&fallback=monogram`;
}

/** Issuer logo in a clipping circle — Flex images take no corner radius of their own. */
export function circleLogo(symbol: string, size = 36): Record<string, unknown> | null {
  const url = logoUrl(symbol);
  if (!url) return null;
  return {
    type: "box",
    layout: "vertical",
    width: `${size}px`,
    height: `${size}px`,
    cornerRadius: `${Math.round(size / 2)}px`,
    backgroundColor: "#FFFFFF",
    borderWidth: "1px",
    borderColor: "#00000014",
    justifyContent: "center",
    flex: 0,
    contents: [{ type: "image", url, size: `${size - 8}px`, aspectMode: "fit", align: "center" }],
  };
}

/** label ⟷ value row on the shared 5:7 grid, so every card's values line up. */
export function kv(
  label: string,
  value: string,
  opts: { color?: string; strong?: boolean } = {},
): Record<string, unknown> {
  return {
    type: "box",
    layout: "horizontal",
    margin: "md",
    contents: [
      { type: "text", text: label, size: "sm", color: C.muted, flex: 5, gravity: "center" },
      {
        type: "text",
        text: value,
        size: "sm",
        color: opts.color ?? C.ink,
        weight: opts.strong ? "bold" : "regular",
        flex: 7,
        align: "end",
        gravity: "center",
        wrap: true,
      },
    ],
  };
}

/**
 * A padded grey block. Grouping rows into two or three blocks reads far calmer
 * than a hairline under every single row.
 */
export function groupCard(rows: unknown[], margin = "md"): Record<string, unknown> {
  return {
    type: "box",
    layout: "vertical",
    backgroundColor: C.soft,
    cornerRadius: "12px",
    paddingAll: "14px",
    margin,
    spacing: "none",
    contents: rows,
  };
}

/**
 * Coloured header strip with the illustration bleeding off its right edge (the
 * artwork is absolutely positioned, so it can overhang into the body).
 */
export function headerStrip(opts: {
  title: string;
  subtitle?: string;
  bg: string;
  fg: string;
  art?: { file: string; ratio: string; width: number; offsetBottom?: string; offsetEnd?: string };
}): Record<string, unknown> {
  const contents: Record<string, unknown>[] = [
    { type: "text", text: opts.title, size: "md", weight: "bold", color: opts.fg },
  ];
  if (opts.subtitle) {
    contents.push({ type: "text", text: opts.subtitle, size: "xxs", color: `${opts.fg}B3`, margin: "xs" });
  }
  if (opts.art) {
    contents.push({
      type: "box",
      layout: "vertical",
      position: "absolute",
      offsetEnd: opts.art.offsetEnd ?? "0px",
      offsetBottom: opts.art.offsetBottom ?? "-10px",
      width: `${opts.art.width}px`,
      contents: [
        {
          type: "image",
          url: `${ART}/${opts.art.file}`,
          size: "full",
          aspectRatio: opts.art.ratio,
          aspectMode: "fit",
        },
      ],
    });
  }
  return {
    type: "box",
    layout: "vertical",
    backgroundColor: opts.bg,
    paddingAll: "16px",
    paddingEnd: opts.art ? `${opts.art.width - 8}px` : "16px",
    height: "68px",
    justifyContent: "center",
    contents,
  };
}
