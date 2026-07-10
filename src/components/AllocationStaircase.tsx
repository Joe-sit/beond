import { MAX_ALLOCATION_SECTORS, type AllocationHolding } from "../data/mockData";
import IssuerLogo from "./IssuerLogo";
import { useAmountsHidden } from "../lib/privacy";

// Parametric pillar built from asset-pillar.svg geometry, widened ~20% so the
// bars read chunkier. Cap slants are fixed; the body stretches with the value.
const FW = 88.35; // front-face width
const W = 150.6; // full pillar width
const PEAK_X = 63.4; // back peak of the top cap
const Y_LEFT = 15.17; // cap corner heights
const Y_MID = 28.16;
const Y_RIGHT = 12.99;

const MAX_BODY = 330; // body height of the tallest pillar
const MIN_BODY = 96; // floor so small holdings stay readable

// The % label sits on the FRONT face. That face is a vertical parallelogram
// whose top edge slopes down to the right, so the text is skewed vertically by
// the same slope (verticals stay upright) to look painted on it.
const FRONT_CX = FW / 2;
const FRONT_SLOPE = (Y_MID - Y_LEFT) / FW;

// Face shades derive from the holding's base hue: front = base,
// top and side are progressively mixed toward white.
function mixWithWhite(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(v + (255 - v) * t);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map(ch);
  return `rgb(${r},${g},${b})`;
}

// Avatar sits flat on the top cap. Center of the cap in local pillar coords.
const TOP_CX = 75.59;
const TOP_CY = 14.08;
const TOKEN = 54; // avatar diameter (local units)
const TOKEN_R = TOKEN / 2;

function formatTHB(value: number): string {
  return new Intl.NumberFormat("th-TH").format(value);
}

interface PillarProps {
  id: string;
  x: number;
  ground: number; // y of the front-left bottom corner on the shared floor
  h: number; // body height
  pct: number;
  color: string;
  label: string;
  symbol?: string; // per-bond view → issuer avatar painted on the front face
  dimmed: boolean;
  index: number;
  onHover: (hovering: boolean) => void;
}

function Pillar({ x, ground, h, pct, color, label, symbol, dimmed, index, onHover }: PillarProps) {
  const top = ground - h - Y_LEFT;
  const p = (px: number, py: number) => `${x + px},${top + py}`;
  // Unfocused pillars wash their hues toward the surface instead of
  // going transparent, so the stack keeps its solid shape.
  const face = mixWithWhite(color, dimmed ? 0.78 : 0);
  const side = mixWithWhite(color, dimmed ? 0.9 : 0.55);
  const cap = mixWithWhite(color, dimmed ? 0.85 : 0.3);
  const faceCls = "transition-[fill] duration-300 ease-out";
  return (
    <g
      className="cursor-pointer outline-none"
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      tabIndex={0}
      role="img"
      aria-label={`${label} ${pct}%`}
      style={{
        transformBox: "fill-box",
        transformOrigin: "bottom",
        animation: "pillar-rise 0.5s cubic-bezier(0.22,1,0.36,1) both",
        animationDelay: `${index * 80}ms`,
      }}
    >
      <polygon
        className={faceCls}
        points={`${p(FW, Y_MID)} ${p(W, Y_RIGHT)} ${p(W, Y_RIGHT + h)} ${p(FW, Y_MID + h)}`}
        fill={side}
      />
      <polygon
        className={faceCls}
        points={`${p(0, Y_LEFT)} ${p(FW, Y_MID)} ${p(FW, Y_MID + h)} ${p(0, Y_LEFT + h)}`}
        fill={face}
      />
      <polygon
        className={faceCls}
        points={`${p(0, Y_LEFT)} ${p(PEAK_X, 0)} ${p(W, Y_RIGHT)} ${p(FW, Y_MID)}`}
        fill={cap}
      />
      {/* Issuer avatar resting flat on the top cap */}
      {symbol && (
        <g
          transform={`translate(${x + TOP_CX} ${top + TOP_CY - 10})`}
          style={{ opacity: dimmed ? 0.5 : 1, transition: "opacity 300ms ease-out" }}
        >
          <circle r={TOKEN_R} fill="#FFFFFF" />
          <foreignObject x={-TOKEN_R} y={-TOKEN_R} width={TOKEN} height={TOKEN}>
            <IssuerLogo symbol={symbol} name={label} size={TOKEN} />
          </foreignObject>
        </g>
      )}
      {/* % painted on the front face — skewed to the face's isometric slope */}
      <text
        transform={`translate(${x + FRONT_CX} ${top + (Y_LEFT + Y_MID) / 2 + h / 2}) matrix(1 ${FRONT_SLOPE} 0 1 0 0)`}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={28}
        className={`pointer-events-none font-nunito font-bold ${faceCls}`}
        fill={dimmed ? mixWithWhite(color, 0.5) : "#FFFFFF"}
        style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.12)", strokeWidth: 3 }}
      >
        {pct}%
      </text>
    </g>
  );
}

// Pillars sit flush on a shared isometric floor (like the Figma reference):
// a column advances along the front-top edge vector, a row recedes along
// the side-top edge vector. Up to 4 columns × 2 rows = 8 pillars.
const FRONT_VEC = { x: FW, y: Y_MID - Y_LEFT }; // right + down
const BACK_VEC = { x: W - FW, y: Y_RIGHT - Y_MID }; // right + up

function slotFor(col: number, row: number) {
  return {
    x: col * FRONT_VEC.x + row * BACK_VEC.x,
    ground: col * FRONT_VEC.y + row * BACK_VEC.y,
  };
}

interface AllocationStaircaseProps {
  holdings: AllocationHolding[];
  activeId: string | null;
  onHover: (id: string | null) => void;
}

export default function AllocationStaircase({
  holdings,
  activeId,
  onHover,
}: AllocationStaircaseProps) {
  const hidden = useAmountsHidden();
  const shown = holdings.slice(0, MAX_ALLOCATION_SECTORS);
  if (shown.length === 0) return null; // nothing to plot — avoid Infinity viewBox
  const maxPct = Math.max(...shown.map((s) => s.pct));

  // Body height scales with the share, but never below MIN_BODY — so a tiny
  // holding (e.g. 4%) still renders a readable pillar with a legible % label
  // instead of a sliver.
  const bodyHeight = (pct: number) =>
    Math.max(MIN_BODY, (pct / maxPct) * MAX_BODY);

  // Split the sorted list so the TALLER half sits on the back row (never
  // occluded by the shorter front row). Within each row, order tallest→shortest
  // so the skyline steps down cleanly and is easy to compare — no random jumble.
  const sorted = [...shown].sort((a, b) => b.pct - a.pct);
  const half = Math.ceil(sorted.length / 2);
  const backs = sorted.slice(0, half); // taller
  const fronts = sorted.slice(half); // shorter

  const placed = [
    ...backs.map((s, col) => ({ s, col, row: 1 })),
    ...fronts.map((s, col) => ({ s, col, row: 0 })),
  ].map(({ s, col, row }) => ({
    id: s.id,
    pct: s.pct,
    color: s.color,
    label: s.label,
    symbol: s.symbol,
    value: s.value,
    h: bodyHeight(s.pct),
    ...slotFor(col, row),
    row,
  }));
  // Paint back row first, then front, left→right (painter's order).
  const pillars = [...placed].sort((a, b) => b.row - a.row || a.x - b.x);

  // Fit the viewBox to the pillars actually rendered.
  const pad = 8;
  const minX = Math.min(...pillars.map((s) => s.x)) - pad;
  const maxX = Math.max(...pillars.map((s) => s.x)) + W + pad;
  const minY = Math.min(...pillars.map((s) => s.ground - s.h - Y_LEFT)) - 44;
  const maxY = Math.max(...pillars.map((s) => s.ground + Y_MID - Y_LEFT)) + pad;

  const active = pillars.find((s) => s.id === activeId);
  const tooltip = active
    ? (() => {
        const line1 = active.label;
        const line2 = `มูลค่า ฿${hidden ? "••••••" : formatTHB(active.value)} (${active.pct}%)`;
        const w = Math.max(line1.length, line2.length) * 11.5 + 32;
        const hBox = 72;
        const x = Math.min(
          Math.max(active.x + PEAK_X - w / 2, minX + 4),
          maxX - w - 4,
        );
        const y = Math.max(active.ground - active.h - Y_LEFT - hBox - 12, minY + 4);
        return { line1, line2, w, hBox, x, y };
      })()
    : null;

  return (
    <svg
      viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
      className="h-full w-full"
      role="img"
      aria-label="สัดส่วนการลงทุนแบบแท่งสามมิติ"
      preserveAspectRatio="xMaxYMax meet"
    >
      {pillars.map((s, i) => (
        <Pillar
          key={s.id}
          {...s}
          index={i}
          dimmed={activeId !== null && activeId !== s.id}
          onHover={(hovering) => onHover(hovering ? s.id : null)}
        />
      ))}

      {tooltip && (
        <g
          className="pointer-events-none"
          style={{ animation: "tooltip-fade 200ms ease-out" }}
        >
          <rect
            x={tooltip.x}
            y={tooltip.y}
            width={tooltip.w}
            height={tooltip.hBox}
            rx={12}
            fill="white"
            stroke="#E7E7E7"
            filter="drop-shadow(0 2px 6px rgba(0,0,0,0.12))"
          />
          <text
            x={tooltip.x + 16}
            y={tooltip.y + 28}
            className="fill-[#43507F] text-[20px] font-bold"
            style={{ fontFamily: "'Sukhumvit Set', sans-serif" }}
          >
            {tooltip.line1}
          </text>
          <text
            x={tooltip.x + 16}
            y={tooltip.y + 55}
            className="fill-black/60 text-[18px]"
            style={{ fontFamily: "'Sukhumvit Set', sans-serif" }}
          >
            {tooltip.line2}
          </text>
        </g>
      )}
    </svg>
  );
}
