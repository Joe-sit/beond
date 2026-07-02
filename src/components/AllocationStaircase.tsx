import { allocationSteps } from "../data/mockData";

// Isometric projection: x → right-down (front), y → left-down (depth), z → up.
const C = Math.cos(Math.PI / 6);
const S = Math.sin(Math.PI / 6);
const UNIT = 34; // px per grid unit
const MAX_H = 2.6; // grid height at 100%

type Vec3 = [number, number, number];

function project(x: number, y: number, z: number, ox: number, oy: number): [number, number] {
  return [ox + (x - y) * C * UNIT, oy + (x + y) * S * UNIT - z * UNIT];
}

function pts(coords: Vec3[], ox: number, oy: number): string {
  return coords.map(([x, y, z]) => project(x, y, z, ox, oy).join(",")).join(" ");
}

interface StepProps {
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  pct: number;
  ox: number;
  oy: number;
}

function Step({ x, y, w, d, h, pct, ox, oy }: StepProps) {
  const top: Vec3[] = [
    [x, y, h],
    [x + w, y, h],
    [x + w, y + d, h],
    [x, y + d, h],
  ];
  const right: Vec3[] = [
    [x + w, y, 0],
    [x + w, y + d, 0],
    [x + w, y + d, h],
    [x + w, y, h],
  ];
  const front: Vec3[] = [
    [x, y + d, 0],
    [x + w, y + d, 0],
    [x + w, y + d, h],
    [x, y + d, h],
  ];
  const [lx, ly] = project(x + w / 2, y + d, h / 2, ox, oy);
  return (
    <g>
      <polygon points={pts(right, ox, oy)} fill="#a3a9b3" />
      <polygon points={pts(front, ox, oy)} fill="#7b828d" />
      <polygon points={pts(top, ox, oy)} fill="#cbd0d7" />
      <text
        x={lx}
        y={ly}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-white font-nunito text-[12px] font-bold"
      >
        {pct}%
      </text>
    </g>
  );
}

export default function AllocationStaircase() {
  const ox = 45;
  const oy = 95;
  const w = 1.2;
  const d = 1.2;

  // Ascending steps to the right; front-most (largest x) drawn last.
  const steps = allocationSteps.map((s, i) => ({
    x: i * w,
    y: 0,
    h: (s.pct / 100) * MAX_H,
    pct: s.pct,
  }));

  return (
    <svg
      viewBox="0 0 200 210"
      className="h-full w-full"
      role="img"
      aria-label="สัดส่วนการลงทุนแบบสามมิติ"
    >
      {steps.map((s, i) => (
        <Step key={i} {...s} w={w} d={d} ox={ox} oy={oy} />
      ))}
    </svg>
  );
}
