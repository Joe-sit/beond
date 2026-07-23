import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import JarGlass, { JarColliders, Coin, JAR_H } from "./Jar3D";
import { getIssuerLogoUrl } from "../../lib/issuerLogo";

// Compact glass money jar for the tax panel corner: every confirmed slip this
// year drops in as an issuer-logo coin and piles up. Locked isometric, static
// (no controls) — purely a visual. Reuses the ?jar POC pieces (Jar3D).
// Physics cap: a full-fee slip can mint dozens of tokens; too many rigid bodies
// in this always-on mini canvas would stall the dashboard. Keep the most recent.
const MAX_COINS = 60;

type Spawn = [number, number, number];

export default function JarWidget({ coins }: { coins: { id: string; symbol: string }[] }) {
  const shown = coins.length > MAX_COINS ? coins.slice(-MAX_COINS) : coins;

  // Freeze each coin's spawn position the FIRST time we see its id. rapier
  // teleports a RigidBody whenever its `position` prop changes, so a fresh random
  // value on every parent re-render (tab switch, unrelated button click) would
  // re-drop the whole pile. A stable per-id spawn = coins fall once, then rest.
  const spawns = useRef(new Map<string, Spawn>());
  const seen = spawns.current;
  shown.forEach((c, i) => {
    if (!seen.has(c.id)) {
      seen.set(c.id, [(Math.random() - 0.5) * 0.5, JAR_H / 2 + 1 + (i % 14) * 0.32, (Math.random() - 0.5) * 0.5]);
    }
  });

  return (
    <div className="pointer-events-none h-56 w-40">
      <Canvas orthographic camera={{ position: [5, 5, 5], zoom: 42 }} className="h-full! w-full!">
        <ambientLight intensity={0.9} />
        <directionalLight position={[3, 5, 4]} intensity={0.9} />
        <Physics gravity={[0, -9.81, 0]} timeStep={1 / 120} numSolverIterations={12}>
          <JarColliders />
          {shown.map((c) => (
            <Coin key={c.id} logoUrl={getIssuerLogoUrl(c.symbol)} position={seen.get(c.id)!} />
          ))}
        </Physics>
        <JarGlass />
        <ContactShadows position={[0, -JAR_H / 2 - 0.02, 0]} opacity={0.14} scale={6} blur={3} far={3} />
      </Canvas>
    </div>
  );
}
