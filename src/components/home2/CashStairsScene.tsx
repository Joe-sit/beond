import { useEffect, useRef, useState } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Physics, RigidBody, CuboidCollider } from "@react-three/rapier";
import { BoxGeometry } from "three";
import type { Group, Mesh, LineSegments, MeshStandardMaterial, OrthographicCamera } from "three";

// three.js staircase (rapier physics) + falling cash: bundles drop from above
// and land — colliding — on the TOP step, piling up. Bump `dropKey` to spawn a
// fresh burst. `?stairtune` opens a live tuner for the camera + geometry.

const STEP_COL = "#EFEFF2";
const STEP_SIDE = "#D9D9DE";
const GREEN_COL = "#7FC98A";

// Camera + geometry config (tunable).
const DEFAULTS = { az: 56, el: 32, roll: 0, zoom: 62, R: 44, cx: -0.5, cy: 4.4, rise: 0.6, tread: 1.1, width: 7.4, topMul: 6.5 };
type Cfg = typeof DEFAULTS;

const stepDepth = (i: number, n: number, c: Cfg) => (i === n - 1 ? c.tread * c.topMul : c.tread);
const stepZ = (i: number, n: number, c: Cfg) => -i * c.tread - stepDepth(i, n, c) / 2 + c.tread / 2;

function DashedEdges({ w, h, d }: { w: number; h: number; d: number }) {
  const ref = useRef<LineSegments>(null);
  useEffect(() => {
    ref.current?.computeLineDistances();
  }, [w, h, d]);
  return (
    <lineSegments ref={ref}>
      <edgesGeometry args={[new BoxGeometry(w, h, d)]} />
      <lineDashedMaterial color="#FFFFFF" dashSize={0.05} gapSize={0.1} transparent opacity={0.9} />
    </lineSegments>
  );
}

function StepBox({ i, n, c, active, refund }: { i: number; n: number; c: Cfg; active: boolean; refund: boolean }) {
  const h = (i + 1) * c.rise;
  const d = stepDepth(i, n, c);
  // Brackets at/above 15% aren't reclaimable — render them as a faded white,
  // dotted-outline "ghost" step instead of a solid tread.
  const faded = !refund && !active;
  // Active step is no longer a flat gold — it keeps its base tint and gets an
  // animated emissive "shimmer" sweep instead.
  const color = refund ? GREEN_COL : STEP_COL;
  const mat = useRef<MeshStandardMaterial>(null);
  useFrame((state) => {
    if (!active || !mat.current) return;
    mat.current.emissiveIntensity = 0.1 + 0.1 * Math.sin(state.clock.elapsedTime * 1.6);
  });
  return (
    <RigidBody type="fixed" colliders={false} position={[0, h / 2, stepZ(i, n, c)]}>
      <CuboidCollider args={[c.width / 2, h / 2, d / 2]} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={[c.width, h, d]} />
        <meshStandardMaterial
          ref={mat}
          color={faded ? "#FFFFFF" : color}
          transparent={faded}
          opacity={faded ? 0.28 : 1}
          emissive={active ? "#FFFFFF" : "#000000"}
          emissiveIntensity={0}
        />
      </mesh>
      {faded ? (
        <DashedEdges w={c.width} h={h} d={d} />
      ) : (
        <mesh position={[c.width / 2 + 0.001, 0, 0]}>
          <boxGeometry args={[0.002, h, d]} />
          <meshStandardMaterial color={STEP_SIDE} />
        </mesh>
      )}
    </RigidBody>
  );
}

const FADE_DUR = 0.4; // seconds

function CashBundle({
  position,
  leaving,
  leaveDelay = 0,
  onGone,
}: {
  position: [number, number, number];
  leaving: boolean;
  leaveDelay?: number;
  onGone: () => void;
}) {
  const spin = useRef<[number, number, number]>([
    (Math.random() - 0.5) * 0.6,
    Math.random() * Math.PI,
    (Math.random() - 0.5) * 0.6,
  ]);
  const grp = useRef<Group>(null);
  const startT = useRef<number | null>(null);
  const gone = useRef(false);

  // On `leaving`, shrink + fade the visuals (after leaveDelay), then remove.
  useFrame((state) => {
    if (!leaving || !grp.current || gone.current) return;
    if (startT.current == null) startT.current = state.clock.elapsedTime + leaveDelay;
    const t = state.clock.elapsedTime - startT.current;
    if (t < 0) return;
    const p = Math.min(1, t / FADE_DUR);
    const s = Math.max(0.001, 1 - p);
    grp.current.scale.setScalar(s);
    grp.current.traverse((o) => {
      const m = (o as Mesh).material;
      if (m && !Array.isArray(m)) {
        m.transparent = true;
        m.opacity = s;
      }
    });
    if (p >= 1) {
      gone.current = true;
      onGone();
    }
  });

  return (
    <RigidBody colliders={false} position={position} rotation={spin.current} ccd restitution={0.1} friction={0.9} density={6}>
      <CuboidCollider args={[0.34, 0.1, 0.22]} />
      <group ref={grp}>
        <mesh castShadow>
          <boxGeometry args={[0.68, 0.2, 0.44]} />
          <meshStandardMaterial color="#8CCB8A" />
        </mesh>
        <mesh position={[0, 0.101, 0]}>
          <boxGeometry args={[0.68, 0.002, 0.44]} />
          <meshStandardMaterial color="#A6E0A2" />
        </mesh>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.7, 0.205, 0.12]} />
          <meshStandardMaterial color="#F4EFE2" />
        </mesh>
      </group>
    </RigidBody>
  );
}

// Drives the orthographic camera from the live cfg (re-applies whenever it changes).
function CameraRig({ c, n }: { c: Cfg; n: number }) {
  const camera = useThree((s) => s.camera) as OrthographicCamera;
  useEffect(() => {
    const az = (c.az * Math.PI) / 180;
    const el = (c.el * Math.PI) / 180;
    const roll = (c.roll * Math.PI) / 180;
    const cy = c.cy;
    const cz = stepZ(n - 1, n, c) / 2;
    camera.position.set(c.cx + c.R * Math.cos(el) * Math.sin(az), cy + c.R * Math.sin(el), cz + c.R * Math.cos(el) * Math.cos(az));
    camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    camera.zoom = c.zoom;
    camera.lookAt(c.cx, cy, cz);
    camera.updateProjectionMatrix();
  }, [c, n, camera]);
  return null;
}

interface Drop { id: number; pos: [number, number, number]; leaving?: boolean; leaveDelay?: number }

const RANGES: Record<keyof Cfg, [number, number, number]> = {
  az: [-180, 180, 1],
  el: [0, 90, 1],
  roll: [-45, 45, 1],
  zoom: [8, 90, 1],
  R: [10, 90, 1],
  cx: [-20, 20, 0.5],
  cy: [-5, 20, 0.5],
  rise: [0.1, 1.5, 0.05],
  tread: [0.3, 3, 0.1],
  width: [2, 16, 0.2],
  topMul: [1, 10, 0.5],
};

// Hard cap on rendered bundles (physics budget). 1 bundle = ฿100.
const MAX_BUNDLES = 120;

export default function CashStairsScene({
  steps,
  activeIndex,
  bundleCount,
  refundZone,
}: {
  steps: number;
  activeIndex: number;
  bundleCount: number; // total cash bundles = total WHT this year / 1,000
  refundZone: (i: number) => boolean;
}) {
  const [cfg, setCfg] = useState<Cfg>(DEFAULTS);
  const tuneOn = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("stairtune");
  const [drops, setDrops] = useState<Drop[]>([]);
  const dropId = useRef(0);

  // Reconcile the pile to the target count (= reclaimable tax / ฿100). Fewer →
  // flag the extra bundles to fade out one-by-one (staggered); more → rain the
  // extra, staggered so it cascades onto the top step.
  useEffect(() => {
    const target = Math.min(MAX_BUNDLES, Math.max(0, Math.round(bundleCount)));
    // Mark excess (newest first) as leaving, with a stagger so they vanish one at
    // a time. Each fades then removes itself via onGone.
    setDrops((d) => {
      const alive = d.filter((x) => !x.leaving);
      const over = alive.length - target;
      if (over <= 0) return d;
      const leavingIds = new Set(alive.slice(alive.length - over).map((x) => x.id));
      let k = 0;
      return d.map((x) => (leavingIds.has(x.id) ? { ...x, leaving: true, leaveDelay: k++ * 0.1 } : x));
    });
    const y = steps * cfg.rise;
    const z = stepZ(steps - 1, steps, cfg);
    const timer = setInterval(() => {
      setDrops((d) => {
        const alive = d.filter((x) => !x.leaving).length;
        if (alive >= target) {
          clearInterval(timer);
          return d;
        }
        const batch = Math.min(3, target - alive);
        const fresh: Drop[] = Array.from({ length: batch }, () => ({
          id: dropId.current++,
          pos: [(Math.random() - 0.5) * 1.6, y + 3 + Math.random() * 2, z + (Math.random() - 0.5) * 1.2],
        }));
        return [...d, ...fresh];
      });
    }, 180);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundleCount, steps]);

  const removeDrop = (id: number) => setDrops((d) => d.filter((x) => x.id !== id));

  return (
    <>
      <Canvas orthographic camera={{ zoom: cfg.zoom, near: 0.1, far: 200 }} className="h-full! w-full!" gl={{ alpha: true }}>
        <CameraRig c={cfg} n={steps} />
        <ambientLight intensity={0.85} />
        <directionalLight position={[5, 8, 4]} intensity={1} castShadow />
        <Physics gravity={[0, -9.81, 0]} timeStep={1 / 120}>
          {Array.from({ length: steps }, (_, i) => (
            <StepBox key={i} i={i} n={steps} c={cfg} active={i === activeIndex} refund={refundZone(i)} />
          ))}
          {drops.map((d) => (
            <CashBundle key={d.id} position={d.pos} leaving={!!d.leaving} leaveDelay={d.leaveDelay} onGone={() => removeDrop(d.id)} />
          ))}
        </Physics>
      </Canvas>
      {tuneOn && <StairTuner cfg={cfg} setCfg={setCfg} />}
    </>
  );
}

function StairTuner({ cfg, setCfg }: { cfg: Cfg; setCfg: (c: Cfg) => void }) {
  const keys = Object.keys(RANGES) as (keyof Cfg)[];
  const line = keys.map((k) => `${k}=${cfg[k]}`).join(" ");
  return (
    <div className="pointer-events-auto absolute right-4 top-4 z-50 w-60 rounded-2xl border border-black/10 bg-white/95 p-4 shadow-xl backdrop-blur">
      <p className="mb-2 font-mono text-xs font-medium text-ink/70">stair tuner (three)</p>
      <div className="flex flex-col gap-1.5">
        {keys.map((k) => {
          const [min, max, step] = RANGES[k];
          return (
            <label key={k} className="flex items-center gap-2 text-xs">
              <span className="w-14 font-mono text-ink/60">{k}</span>
              <input type="range" min={min} max={max} step={step} value={cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: Number(e.target.value) })} className="flex-1" />
              <span className="w-10 text-right font-mono text-ink">{cfg[k]}</span>
            </label>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={() => navigator.clipboard?.writeText(line)} className="flex-1 rounded-lg bg-ink px-2 py-1 text-xs text-white">copy</button>
        <button onClick={() => setCfg(DEFAULTS)} className="rounded-lg border border-black/15 px-2 py-1 text-xs text-ink">reset</button>
      </div>
    </div>
  );
}
