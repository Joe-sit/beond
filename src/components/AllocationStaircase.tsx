import { MAX_ALLOCATION_SECTORS, type AllocationHolding } from "../data/mockData";
import { SECTOR_ICON, SECTOR_ICON_FALLBACK } from "../data/sectorIcons";

// Parametric pillar built from asset-pillar.svg geometry (126×207).
// Cap slants are fixed; the body stretches vertically with the value.
const FW = 73.625; // front-face width
const W = 125.53; // full pillar width
const PEAK_X = 52.82; // back peak of the top cap
const Y_LEFT = 15.17; // cap corner heights
const Y_MID = 28.16;
const Y_RIGHT = 12.99;

const MAX_BODY = 330; // body height of the tallest pillar
const MIN_LABEL_BODY = 48; // below this, the % label moves above the cap

// Centroid of the top-cap parallelogram (local frame) for the sector icon.
const CAP_CX = (0 + PEAK_X + W + FW) / 4;
const CAP_CY = (Y_LEFT + 0 + Y_RIGHT + Y_MID) / 4;
const CAP_ICON = 22;

// Face shades derive from the holding's base hue: front = base,
// top and side are progressively mixed toward white.
function mixWithWhite(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(v + (255 - v) * t);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map(ch);
  return `rgb(${r},${g},${b})`;
}

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
  dimmed: boolean;
  onHover: (hovering: boolean) => void;
}

function Pillar({ id, x, ground, h, pct, color, label, dimmed, onHover }: PillarProps) {
  const top = ground - h - Y_LEFT;
  const p = (px: number, py: number) => `${x + px},${top + py}`;
  const labelOnFace = h >= MIN_LABEL_BODY;
  const Icon = SECTOR_ICON[id] ?? SECTOR_ICON_FALLBACK;
  const iconColor = mixWithWhite(color, dimmed ? 0.7 : 0);
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
      <circle
        cx={x + CAP_CX}
        cy={top + CAP_CY}
        r={CAP_ICON * 0.72}
        fill="#FFFFFF"
        className={faceCls}
        opacity={dimmed ? 0.55 : 1}
      />
      <Icon
        x={x + CAP_CX - CAP_ICON / 2}
        y={top + CAP_CY - CAP_ICON / 2}
        width={CAP_ICON}
        height={CAP_ICON}
        stroke={2}
        color={iconColor}
        className={`pointer-events-none ${faceCls}`}
      />
      <text
        x={x + (labelOnFace ? FW / 2 : PEAK_X)}
        y={
          labelOnFace
            ? top + (Y_LEFT + Y_MID) / 2 + Math.min(h * 0.35, 60)
            : top - 22
        }
        textAnchor="middle"
        dominantBaseline="central"
        className={`pointer-events-none font-nunito font-bold ${
          labelOnFace ? "text-3xl" : "text-lg"
        } ${faceCls}`}
        fill={
          labelOnFace
            ? dimmed
              ? mixWithWhite(color, 0.45)
              : "#FFFFFF"
            : dimmed
              ? mixWithWhite("#43507F", 0.6)
              : "#43507F"
        }
        style={
          labelOnFace
            ? undefined
            : { paintOrder: "stroke", stroke: "#FFFFFF", strokeWidth: 4 }
        }
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
  const shown = holdings.slice(0, MAX_ALLOCATION_SECTORS);
  const maxPct = Math.max(...shown.map((s) => s.pct));

  // Taller half lives on the back row, shorter half up front — so no front
  // pillar can ever occlude a back face. Column order is then shuffled into
  // a jagged skyline (like the Figma reference) instead of a staircase.
  const SKYLINE = [2, 0, 3, 1];
  const sorted = [...shown].sort((a, b) => b.pct - a.pct);
  const half = Math.ceil(sorted.length / 2);
  const shuffle = (arr: typeof sorted) =>
    SKYLINE.filter((i) => i < arr.length).map((i) => arr[i]);
  const backs = shuffle(sorted.slice(0, half));
  const fronts = shuffle(sorted.slice(half));

  const placed = [
    ...backs.map((s, col) => ({ s, col, row: 1 })),
    ...fronts.map((s, col) => ({ s, col, row: 0 })),
  ].map(({ s, col, row }) => ({
    id: s.id,
    pct: s.pct,
    color: s.color,
    label: s.label,
    value: s.value,
    h: (s.pct / maxPct) * MAX_BODY,
    ...slotFor(col, row),
    row,
  }));
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
        const line2 = `มูลค่า ฿${formatTHB(active.value)} (${active.pct}%)`;
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
      {pillars.map((s) => (
        <Pillar
          key={s.id}
          {...s}
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
