import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import JarGlass, { JarColliders, Coin, JAR_H } from "./Jar3D";
import { getIssuerLogoUrl } from "../../lib/issuerLogo";

// Real issuer tickers to demo the logo tokens (logo.dev resolves each).
const SAMPLE = ["GULF", "CPALL", "SIRI", "BTSG", "PTT", "SCB", "TRUE", "BRI", "ORI", "MINT"];

type CoinItem = { id: number; symbol: string };

// `?jar` — real 3D glass money jar with physics. Drag to orbit; drop coins that
// fall in and pile up (rapier). Each coin is an issuer token (logo face).
export default function JarPOC() {
  const [coins, setCoins] = useState<CoinItem[]>([]);

  const drop = (n = 1) =>
    setCoins((c) => [
      ...c,
      ...Array.from({ length: n }, (_, k) => ({
        id: Date.now() + k,
        symbol: SAMPLE[Math.floor(Math.random() * SAMPLE.length)],
      })),
    ]);

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-[#8AA6C8] to-[#EAF0F6]">
      <div className="absolute left-6 top-6 z-10 w-64 rounded-3xl bg-white/85 p-5 backdrop-blur">
        <h1 className="text-xl font-medium text-[#181D20]">Debug · โหลแก้ว 3D + physics</h1>
        <p className="mt-1 text-xs text-black/55">ลากหมุน · สกอลล์ซูม · เหรียญตกจริง</p>
        <p className="mt-3 text-sm font-medium text-black/60">เหรียญในโหล: {coins.length}</p>
        <div className="mt-3 flex gap-2">
          <button onClick={() => drop(1)} className="flex-1 rounded-2xl bg-[#43507F] px-3 py-2.5 text-sm font-medium text-white transition hover:bg-[#3a466e]">
            🪙 หยอด 1
          </button>
          <button onClick={() => drop(10)} className="flex-1 rounded-2xl bg-[#43507F] px-3 py-2.5 text-sm font-medium text-white transition hover:bg-[#3a466e]">
            +10
          </button>
        </div>
        <button onClick={() => setCoins([])} className="mt-2 w-full rounded-2xl border border-black/10 px-3 py-2 text-sm font-medium text-ink transition hover:bg-black/5">
          ล้าง
        </button>
      </div>

      <Canvas orthographic camera={{ position: [5, 5, 5], zoom: 120 }} className="h-full! w-full!">
        {/* Flat, even 2.5D lighting: strong ambient + one soft key for the toon step. */}
        <ambientLight intensity={0.9} />
        <directionalLight position={[3, 5, 4]} intensity={0.9} />
        <Physics gravity={[0, -9.81, 0]} timeStep={1 / 120} numSolverIterations={12}>
          <JarColliders />
          {coins.map((c, i) => (
            <Coin
              key={c.id}
              logoUrl={getIssuerLogoUrl(c.symbol)}
              // Stagger drop height per coin so a batch doesn't spawn inside each
              // other (which reads as interpenetration before rapier separates them).
              position={[(Math.random() - 0.5) * 0.5, JAR_H / 2 + 1.2 + (i % 10) * 0.35, (Math.random() - 0.5) * 0.5]}
            />
          ))}
        </Physics>
        <JarGlass />
        <ContactShadows position={[0, -JAR_H / 2 - 0.02, 0]} opacity={0.16} scale={6} blur={3.2} far={3} />
        {/* Locked isometric: zoom only, no orbit/pan. */}
        <OrbitControls enablePan={false} enableRotate={false} minZoom={70} maxZoom={220} target={[0, 0, 0]} />
      </Canvas>
    </div>
  );
}
