import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { CoinVisual } from "./Jar3D";
import { getIssuerLogoUrl } from "../../lib/issuerLogo";

// One spinning issuer token: the coin faces the camera and spins around the
// vertical axis (sweeping face → edge → back), then eases to a stop face-front.
// Reuses the jar's CoinVisual so the look matches the pile exactly.
function SpinningCoin({ logoUrl }: { logoUrl?: string | null }) {
  const g = useRef<Group>(null);
  const start = useRef<number | null>(null);
  const TURNS = 2; // whole revolutions before it lands
  const DUR = 1.6; // seconds — slow, gentle glide to rest

  // Deterministic eased spin: rotate exactly TURNS full turns over DUR with an
  // easeOut, so it decelerates smoothly and LANDS on a face-front angle (an
  // integer multiple of 2π) — no velocity decay + snap, no jerk.
  useFrame((state) => {
    const grp = g.current;
    if (!grp) return;
    if (start.current == null) start.current = state.clock.elapsedTime;
    const t = Math.min(1, (state.clock.elapsedTime - start.current) / DUR);
    const e = 1 - Math.pow(1 - t, 3); // easeOutCubic
    grp.rotation.y = TURNS * Math.PI * 2 * e;
  });

  return (
    <group ref={g}>
      {/* Tilt the coin so its +Y face points toward the camera (+Z). */}
      <group rotation={[Math.PI / 2, 0, 0]}>
        <CoinVisual logoUrl={logoUrl} outline />
      </group>
    </group>
  );
}

export default function Token3D({ symbol, size = 40, fit = 1.24 }: { symbol: string; size?: number; fit?: number }) {
  // `fit` = coin diameter as a fraction of the box (1.24 ≈ original). Higher =
  // smaller coin + more margin. Note: never mount this inside a CSS-scaling
  // wrapper — r3f measures the frustum once on mount, so a tiny initial size
  // leaves the coin oversized (cropped) after it grows.
  return (
    <div style={{ width: size, height: size }} className="pointer-events-none">
      <Canvas orthographic camera={{ position: [0, 0.8, 5], zoom: size / fit }} className="h-full! w-full!" gl={{ alpha: true }}>
        <ambientLight intensity={0.95} />
        <directionalLight position={[2, 4, 5]} intensity={0.8} />
        <SpinningCoin logoUrl={getIssuerLogoUrl(symbol)} />
      </Canvas>
    </div>
  );
}
