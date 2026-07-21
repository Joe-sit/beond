import { useEffect, useState } from "react";

const fmtTHB = (n: number) => new Intl.NumberFormat("th-TH").format(Math.round(n));

// Semicircular refund gauge. The arc sweeps from 0 → `value`, out of a full-year
// potential `max` (the whole ring). Needle + filled arc animate in when `play`
// flips true. Colour ramps green as the ring fills — "collect more slips → more
// of the ring lights up".
const R = 140; // arc radius
const CX = 160;
const CY = 168; // baseline (semicircle sits above)
const STROKE = 26;
const START = 180; // left end (deg, SVG: 180 = pointing left)
const SWEEP = 180; // half turn to the right

// Polar point on the gauge arc for an angle measured from START going clockwise.
function pt(angleDeg: number, r = R) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) };
}
// SVG arc path from fraction f0→f1 of the semicircle (0 = left, 1 = right).
function arc(f0: number, f1: number, r = R) {
  const a0 = START - f0 * SWEEP;
  const a1 = START - f1 * SWEEP;
  const p0 = pt(a0, r);
  const p1 = pt(a1, r);
  const large = Math.abs(a0 - a1) > 180 ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`;
}

export default function RefundGauge({
  value,
  max,
  play,
  label = "ขอคืนแล้วปีนี้",
}: {
  value: number;
  max: number;
  play: boolean;
  label?: string;
}) {
  const target = max > 0 ? Math.min(1, value / max) : 0;
  const [frac, setFrac] = useState(0); // animated fill 0→target
  const [shown, setShown] = useState(0); // animated ฿ count-up

  useEffect(() => {
    if (!play) return;
    const start = performance.now();
    const dur = 1400;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setFrac(target * e);
      setShown(value * e);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [play, target, value]);

  // Green intensifies as the ring fills.
  const fill = `hsl(${100 + frac * 40}, ${45 + frac * 25}%, ${52 - frac * 8}%)`;
  const needle = pt(START - frac * SWEEP, R - STROKE / 2 - 6);

  return (
    <svg viewBox="0 0 320 200" className="h-full w-full" role="img" aria-label={`${label} ${fmtTHB(value)} บาท`}>
      {/* track */}
      <path d={arc(0, 1)} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={STROKE} strokeLinecap="round" />
      {/* filled portion */}
      <path d={arc(0, Math.max(0.0001, frac))} fill="none" stroke={fill} strokeWidth={STROKE} strokeLinecap="round" />
      {/* needle */}
      <line x1={CX} y1={CY} x2={needle.x} y2={needle.y} stroke="#1F2937" strokeWidth={3.5} strokeLinecap="round" />
      <circle cx={CX} cy={CY} r={7} fill="#1F2937" />
      {/* centre readout */}
      <text x={CX} y={CY - 40} textAnchor="middle" className="fill-ink font-nunito font-extrabold" fontSize={40}>
        ฿{fmtTHB(shown)}
      </text>
      <text x={CX} y={CY - 12} textAnchor="middle" className="fill-black/45" fontSize={14}>
        จากเต็มปี ฿{fmtTHB(max)}
      </text>
    </svg>
  );
}
