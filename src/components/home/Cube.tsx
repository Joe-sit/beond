import type { ReactNode } from "react";
import { motion } from "motion/react";

export type CubeVariant = "confirmed" | "pending" | "empty";

// Isometric coupon cube for the timeline (geometry from Figma node 787:2407).
// Solid, minimally-glassy 3-tone faces (top light, left dark, right mid) with a
// faint top sheen + white rim. Cubes stack head-to-head and drop in from above
// with a springy, gravity-like settle.
const TOP = "M0 15.21 L52.32 0 L124.33 13.03 L72.67 28.24 Z";
const LEFT = "M72.67 28.24 L72.67 117 L0 103.97 L0 15.21 Z";
const RIGHT = "M72.67 28.24 L124.34 13.03 L124.34 101.79 L72.68 117 Z";
const SHEEN = "M14 15.4 L52.32 4.2 L96 12.6 L62 22 Z";

// Cube geometry constants (svg units) — shared with the stack maths.
export const CUBE_H = 117;
export const CUBE_STACK_OFFSET = 89; // vertical gap between stacked cubes

const TINT: Record<"confirmed" | "pending", { left: string; right: string; top: string }> = {
  confirmed: { left: "#009A28", right: "#12BC59", top: "#4FD873" },
  pending: { left: "#98A2B0", right: "#C3CBD6", top: "#D6DCE5" },
};

export default function Cube({
  variant,
  children,
  delay = 0,
}: {
  variant: CubeVariant;
  children?: ReactNode; // e.g. the issuer logo pinned to the front face
  delay?: number; // entrance stagger (seconds)
}) {
  return (
    <motion.div
      className="relative w-full drop-shadow-[0_5px_9px_rgba(20,40,25,0.10)]"
      initial={{ y: "-140%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ y: { type: "tween", ease: "easeIn", duration: 0.4, delay }, opacity: { duration: 0.15, delay } }}
    >
      {variant === "empty" ? (
        <svg viewBox="0 0 125 117" className="block h-auto w-full" fill="none">
          <g fill="none" stroke="#B7BECB" strokeWidth="1.4" strokeDasharray="3 3" strokeLinejoin="round">
            <path d={TOP} />
            <path d={LEFT} />
            <path d={RIGHT} />
          </g>
        </svg>
      ) : (
        <Faces variant={variant} />
      )}

      {/* Avatar on the left front face (Figma ellipse centroid ≈ 29%, 55%) */}
      {children && (
        <span className="absolute top-[55%] left-[29%] -translate-x-1/2 -translate-y-1/2">{children}</span>
      )}
    </motion.div>
  );
}

function Faces({ variant }: { variant: "confirmed" | "pending" }) {
  const t = TINT[variant];
  return (
    <svg viewBox="0 0 125 117" className="block h-auto w-full" fill="none">
      <defs>
        <linearGradient id={`${variant}-sheen`} x1="20" y1="4" x2="88" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Solid faces */}
      <path d={LEFT} fill={t.left} />
      <path d={RIGHT} fill={t.right} />
      <path d={TOP} fill={t.top} />

      {/* Minimal glass: faint sheen + thin white rim on the upper edges */}
      <path d={SHEEN} fill={`url(#${variant}-sheen)`} />
      <path d="M0 15.21 L52.32 0" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="1" fill="none" />
      <path d="M52.32 0 L124.33 13.03" stroke="#FFFFFF" strokeOpacity="0.32" strokeWidth="1" fill="none" />
    </svg>
  );
}
