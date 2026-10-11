import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import JarGlass, { JarColliders, Coin, JAR_H } from "../home2/Jar3D";
import { getIssuerLogoUrl } from "../../lib/issuerLogo";

/**
 * The refund landing in the jar — coins dropping in, one after another.
 *
 * The same jar the dashboard uses, so this is the product rather than a drawing
 * of it. Two things are deliberate:
 *
 *   - It is only mounted while its scene is on screen. The landing already runs
 *     a WebGL renderer for the 3D device, and a second one that lives for the
 *     whole page is how a browser starts dropping contexts.
 *   - Coins stop at CAP. Physics with an unbounded pile is a scroll-length
 *     stress test the visitor never asked for.
 */

const ISSUERS = ["GULF", "CPALL", "SIRI", "BTSG", "PTT", "SCB", "BRI", "ORI"];
const CAP = 10;
const EVERY = 620; // ms between drops

export default function RefundJar() {
  const [n, setN] = useState(0);

  useEffect(() => {
    if (n >= CAP) return;
    const t = setTimeout(() => setN((v) => v + 1), EVERY);
    return () => clearTimeout(t);
  }, [n]);

  return (
    <Canvas orthographic camera={{ position: [5, 5, 5], zoom: 73 }} className="h-full! w-full!">
      {/* Flat, even 2.5D lighting: strong ambient + one soft key for the toon step. */}
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 5, 4]} intensity={0.9} />
      {/* Rapier's wasm suspends on first load. Kept inside its own boundary so
          the suspension never reaches the boundary above the <Canvas>: React
          hides a suspended tree with display:none, and a hidden canvas loses
          its WebGL context and comes back blank. */}
      <Suspense fallback={null}>
        <Physics gravity={[0, -9.81, 0]} timeStep={1 / 120} numSolverIterations={12}>
          <JarColliders />
          {Array.from({ length: n }).map((_, i) => (
            <Coin
              key={i}
              logoUrl={getIssuerLogoUrl(ISSUERS[i % ISSUERS.length])}
              position={[(i % 3) * 0.22 - 0.22, JAR_H / 2 + 1.4, ((i * 7) % 3) * 0.22 - 0.22]}
            />
          ))}
        </Physics>
      </Suspense>
      <JarGlass />
      <ContactShadows position={[0, -JAR_H / 2 - 0.02, 0]} opacity={0.16} scale={6} blur={3.2} far={3} />
      {/* The only thing aiming the camera. Locked: every gesture belongs to the
          page, which is doing the scrolling. */}
      <OrbitControls enablePan={false} enableRotate={false} enableZoom={false} target={[0, 0, 0]} />
    </Canvas>
  );
}
