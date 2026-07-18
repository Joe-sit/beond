import { motion } from "motion/react";

// Semicircular gauge for the tax-refund hero: a green arc whose fill is the
// share already confirmed vs. the total refundable (confirmed + pending).
export default function RefundGauge({ confirmed, pending }: { confirmed: number; pending: number }) {
  const total = confirmed + pending;
  const ratio = total > 0 ? confirmed / total : 0;

  // Half-circle arc geometry (180° sweep, left → right, opening down).
  const w = 220, h = 118, r = 92, cx = w / 2, cy = 104, sw = 18;
  const pt = (frac: number) => {
    const a = Math.PI * (1 - frac); // π (left) → 0 (right)
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  };
  const arc = (from: number, to: number) => {
    const [x0, y0] = pt(from);
    const [x1, y1] = pt(to);
    return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" role="img" aria-label="สัดส่วนภาษีที่ยืนยันแล้ว">
      <defs>
        <linearGradient id="gauge-green" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#12BC59" />
          <stop offset="100%" stopColor="#00C732" />
        </linearGradient>
      </defs>
      {/* track (unconfirmed) */}
      <path d={arc(0, 1)} fill="none" stroke="#ffffff" strokeOpacity={0.35} strokeWidth={sw} strokeLinecap="round" />
      {/* confirmed fill — sweeps in from empty → its value on mount */}
      {ratio > 0 && (
        <motion.path
          key={ratio}
          d={arc(0, Math.max(0.02, ratio))}
          fill="none"
          stroke="url(#gauge-green)"
          strokeWidth={sw}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      )}
    </svg>
  );
}
