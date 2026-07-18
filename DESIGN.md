# beond — Design System

Single source of truth for colours, typography, radii, and component conventions.
Tokens live in [`src/index.css`](src/index.css) under `@theme`; Tailwind v4 turns
each `--color-*` into utilities you use directly in class names.

## Colour tokens

| Token | Hex | Utility examples | Use for |
|-------|-----|------------------|---------|
| `brand` | `#43507F` | `bg-brand` `text-brand` | Primary navy — headings, nav, primary buttons |
| `brand-blue` | `#2968A5` | `text-brand-blue` | Accent blue — links, secondary actions, field focus |
| `sky` | `#779BC6` | `from-sky` | Hero sky gradient (top) |
| `surface` | `#F6F4F1` | `bg-surface` | App background (cream) |
| `card` | `#FFFFFF` | `bg-card` | Card surface |
| `line` | `#E7E7E7` | `border-line` | Hairline border |
| `line-soft` | `#F0F0F0` | `border-line-soft` | Softer divider |
| `ink` | `#222222` | `text-ink` | Primary text |
| `ink-soft` | `#8A8A8A` | `text-ink-soft` | Secondary / muted text |
| `success` | `#12BC59` | `bg-success` `text-success` | Confirmed / positive |
| `success-soft` → `success-mid` → `success-strong` | `#69E889` `#00C732` `#00B12D` | `from-success-soft via-success-mid to-success-strong` | Green card / gauge / active-bar gradient |
| `warning` | `#C0563B` | `text-warning` | Final-tax / owe-more advice |
| `pending` | `#D97706` | `text-pending` | Awaiting confirmation (amber) |

Prefer tokens over raw hex in new code. Legacy components still carry raw hex;
migrate opportunistically, not in bulk.

## Typography

- **Body (Thai + Latin):** `Noto Sans Thai` (default `font-sukhumvit`).
- **Numbers / figures:** `Nunito` via `font-nunito` — apply to every ฿ amount,
  percentage, year, and count so digits align and read as data.
- Scale: page title `text-lg font-bold`, card title `text-sm/base font-bold`,
  hero figure `text-2xl–3xl font-bold`, label `text-xs–sm text-ink-soft`.

## Shape & elevation

- **Radii:** cards `rounded-3xl` (24px) / hero + portfolio `rounded-[40px]`;
  pills & chips `rounded-full`; inputs & small blocks `rounded-xl/2xl`.
- **Borders:** 1px `border-line` on white cards; no border on gradient cards.
- **Shadow:** flat by default; `shadow-md`/`shadow-xl` only on floating layers
  (nav buttons, the timeline detail card, FAB).
- **2.5D blocks** (tax staircase, timeline bars): front gradient + offset solid
  extrusion `box-shadow: Xpx Ypx 0 <darker>`; darker face ≈ base − 32% lightness.

## Layout

- Desktop-first dashboard: left **icon rail** (`SidebarRail`, 72px) + a two-column
  grid — main content `1fr`, monthly-slip column `446px`. Collapses to a single
  column with a bottom bar under `lg`.
- App background is `bg-surface`; content sits on `bg-card` panels.

## Components (home)

`home/` holds the redesigned dashboard: `DashboardShell` (rail + views),
`HeroCard` (refund gauge), `PortfolioCard`, `TimelineCard` (2.5D bars +
floating installment card), `MonthlySlipColumn`, `RefundGauge`, `SidebarRail`.
