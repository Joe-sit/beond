import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider, CylinderCollider } from "@react-three/rapier";
import { Outlines } from "@react-three/drei";
import * as THREE from "three";
import efilingMark from "../../assets/efiling-sticker.png";

// Real 3D mason money jar (three.js / rapier), illustrated 2.5D look: flat toon
// shading + black outlines. Body is a surface-of-revolution (LatheGeometry) so it
// has the classic jar silhouette — wide body, curved shoulder, narrow neck, lip.
// Render inside a <Canvas> wrapped in <Physics>. Coins fall in and pile up.

// Overall jar object size. Scales the glass mesh + physics colliders together
// while the coins keep their own radius, so a bigger jar simply holds more.
export const JAR_SCALE = 1.6;
export const JAR_R = 1 * JAR_SCALE;
export const JAR_H = 2.4 * JAR_SCALE;
const BODY_TOP = 0.55; // where the straight body ends and the shoulder curves in
const N = 28; // wall segments for the collider ring

// Jar silhouette profile (radius, height) revolved around Y.
const PROFILE: [number, number][] = [
  [0.98, -1.20],
  [1.00, -1.02],
  [1.00, BODY_TOP],
  [0.97, 0.74],
  [0.84, 0.94],
  [0.66, 1.10],
  [0.63, 1.22],
  [0.63, 1.36],
];

// ── Visual glass (no physics) ────────────────────────────────────────────────
export default function JarGlass() {
  const pts = useMemo(() => PROFILE.map(([x, y]) => new THREE.Vector2(x, y)), []);

  return (
    <group scale={JAR_SCALE}>
      {/* Glass shell — lathed jar body, translucent + black silhouette outline. */}
      <mesh>
        <latheGeometry args={[pts, 64]} />
        <meshBasicMaterial color="#cfe4fb" transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Closed base disc. */}
      <mesh position={[0, -1.16, 0]}>
        <cylinderGeometry args={[0.99, 0.96, 0.1, 64]} />
        <meshBasicMaterial color="#dcecfb" transparent opacity={0.2} depthWrite={false} />
      </mesh>

      {/* Rim / screw-band lip at the mouth. */}
      <mesh position={[0, 1.34, 0]}>
        <cylinderGeometry args={[0.7, 0.66, 0.2, 48, 1, true]} />
        <meshToonMaterial color="#c3d9ee" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 1.44, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.68, 0.05, 16, 48]} />
        <meshToonMaterial color="#b6cfe6" />
      </mesh>
    </group>
  );
}

// ── "Sent to e-Filing" seal: 3D screw lid + sticker ──────────────────────────
// Plays once when `active` flips true: a metal screw lid falls onto the mouth
// and seats with a little overshoot, then — after a clear pause — an e-Filing
// sticker rolls onto the jar's front. Both are real meshes in the scene (not a
// DOM overlay), so they sit in the same isometric projection as the glass and
// coins. The pause matters: these are two separate beats the user is meant to
// read, and EfilingSealOverlay's captions are timed to them.

// Overshoot easing — the lid lands with weight, the sticker pops like it was
// pressed on by hand.
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

const LID_FALL = 0.8; // seconds: lid drop + seat
const STICKER_DELAY = 0.9; // sticker waits for the lid to seat + settle
const STICKER_PEEL = 1.2; // seconds to roll the sticker on
const LID_FROM = 2.2; // local Y the lid falls from

// Sticker patch on the jar wall. Arc length is matched to its height
// (θ = h / r) so the round label doesn't render as an oval on the curve.
const ST_R = 1.012; // sits a hair proud of the glass
const ST_THETA = 0.85;
const ST_H = 0.86;
const ST_Y = 0.13; // above the coin pile, below the shoulder
const CURL_R = 0.17; // radius of the not-yet-applied roll (loose enough to read)

// Lay the sticker down like a decal being rolled on: everything before the
// contact point `p` lies on the jar's cylinder, and the rest peels off it in a
// roll that continues tangentially from that point and curls back over itself.
// Writes straight into the buffer each frame — no geometry churn, no re-render.
function layPeel(geo: THREE.BufferGeometry, p: number) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const L = ST_R * ST_THETA; // total arc length of the sticker
  const A = ST_THETA / 2;
  const ac = -A + p * ST_THETA; // angle of the contact point
  // Frame at the contact point: T along the direction of travel, N outward.
  const cx = ST_R * Math.sin(ac);
  const cz = ST_R * Math.cos(ac);
  const tx = Math.cos(ac);
  const tz = -Math.sin(ac);
  const nx = Math.sin(ac);
  const nz = Math.cos(ac);
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i);
    const y = (uv.getY(i) - 0.5) * ST_H + ST_Y;
    if (u <= p) {
      const a = -A + u * ST_THETA;
      pos.setXYZ(i, ST_R * Math.sin(a), y, ST_R * Math.cos(a));
    } else {
      const phi = ((u - p) * L) / CURL_R; // arc travelled around the roll
      const k = CURL_R * (1 - Math.cos(phi));
      const m = CURL_R * Math.sin(phi);
      pos.setXYZ(i, cx + nx * k + tx * m, y, cz + nz * k + tz * m);
    }
  }
  pos.needsUpdate = true;
}

// The sticker artwork: a round die-cut label — white disc + the e-Filing mark
// (Figma 1412:4928) — composited on a canvas and mapped onto a curved patch
// that hugs the jar wall. The disc is drawn immediately so the sticker never
// pops in blank; the logo is painted over it once the PNG decodes.
function useStickerTexture() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 512;
    const g = c.getContext("2d")!;
    const mid = c.width / 2;
    // Die-cut white label with a soft edge ring so it reads on clear glass.
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(mid, mid, 246, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(20,40,70,0.14)";
    g.lineWidth = 6;
    g.beginPath();
    g.arc(mid, mid, 243, 0, Math.PI * 2);
    g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    // Logo on top, centred, once decoded.
    const img = new Image();
    img.onload = () => {
      const s = 330;
      g.drawImage(img, mid - s / 2, mid - s / 2, s, s);
      t.needsUpdate = true;
    };
    img.src = efilingMark;
    return t;
  }, []);
  // Canvas textures aren't managed by r3f's cache — dispose it ourselves.
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

export function JarSeal({ active }: { active: boolean }) {
  const lid = useRef<THREE.Group>(null);
  const sticker = useRef<THREE.Mesh>(null);
  const start = useRef<number | null>(null);
  const tex = useStickerTexture();

  // A flat grid we rewrite every frame into the peel shape (see layPeel). Only
  // the U direction needs segments — the sticker never bends vertically.
  const peelGeo = useMemo(() => new THREE.PlaneGeometry(1, 1, 64, 1), []);
  useEffect(() => () => peelGeo.dispose(), [peelGeo]);

  // Restart the animation each time the seal turns on.
  useEffect(() => {
    start.current = null;
  }, [active]);

  useFrame((state) => {
    if (!lid.current || !sticker.current) return;
    if (!active) return;
    if (start.current == null) start.current = state.clock.elapsedTime;
    const t = state.clock.elapsedTime - start.current;

    const drop = easeOutBack(clamp01(t / LID_FALL));
    lid.current.position.y = LID_FROM * (1 - drop);
    lid.current.rotation.z = (1 - drop) * -0.22;
    // Screws itself shut on the way down.
    lid.current.rotation.y = (1 - drop) * 1.4;

    // Rolled up out of sight until its turn, then laid on left→right.
    const peel = clamp01((t - STICKER_DELAY) / STICKER_PEEL);
    sticker.current.visible = t >= STICKER_DELAY;
    // Smoothstep: eases in and out but rolls at a steady rate through the middle
    // — a front-loaded ease snaps most of the sticker down before the curl reads.
    layPeel(peelGeo, peel * peel * (3 - 2 * peel));
  });

  if (!active) return null;

  return (
    <group scale={JAR_SCALE}>
      {/* Screw lid — a shallow cap over a ribbed band, sized to the jar's mouth.
          Flat (basic) materials, like the glass, so it stays in the illustrated
          2.5D look instead of picking up a grey shading ramp. */}
      <group ref={lid} position={[0, LID_FROM, 0]}>
        {/* Cap — slight taper reads as a lid, not a coin. */}
        <mesh position={[0, 1.5, 0]}>
          <cylinderGeometry args={[0.72, 0.78, 0.17, 48]} />
          <meshBasicMaterial color="#dae5f2" />
          <Outlines thickness={1.2} color="#8fa2b6" />
        </mesh>
        {/* Lighter top face + a pressed inner ring, for a bit of depth. */}
        <mesh position={[0, 1.586, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.72, 48]} />
          <meshBasicMaterial color="#eef4fb" />
        </mesh>
        <mesh position={[0, 1.589, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.55, 48]} />
          <meshBasicMaterial color="#cbd9e8" />
        </mesh>
        {/* Ribbed screw band gripping the neck. */}
        <mesh position={[0, 1.33, 0]}>
          <cylinderGeometry args={[0.78, 0.77, 0.28, 48, 1, true]} />
          <meshBasicMaterial color="#bccddf" side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 1.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.77, 0.035, 12, 48]} />
          <meshBasicMaterial color="#a6b9cd" />
        </mesh>
      </group>

      {/* Sticker — a decal rolled onto the glass. Its vertices are rewritten
          each frame (layPeel): the applied part wraps the jar's own cylinder,
          the rest curls off it. Rotated to the camera's isometric front (+X +Z).
          Frustum culling off — the bounds change every frame. */}
      <mesh
        ref={sticker}
        geometry={peelGeo}
        rotation={[0, Math.PI / 4, 0]}
        visible={false}
        frustumCulled={false}
      >
        <meshBasicMaterial map={tex} transparent side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ── Static colliders: a ring of thin walls + a floor disc ────────────────────
export function JarColliders() {
  const S = JAR_SCALE;
  const hw = JAR_R * Math.tan(Math.PI / N) * 1.15; // wall half-width (+overlap)
  const wallH = ((BODY_TOP + 1.2) / 2) * S; // wall spans the straight body only
  const floorY = -1.2 * S;
  return (
    <RigidBody type="fixed" colliders={false}>
      {Array.from({ length: N }).map((_, i) => {
        const a = (i / N) * Math.PI * 2;
        return (
          <CuboidCollider
            key={i}
            args={[hw, wallH, 0.04 * S]}
            position={[Math.sin(a) * JAR_R, floorY + wallH, Math.cos(a) * JAR_R]}
            rotation={[0, a, 0]}
          />
        );
      })}
      <CylinderCollider args={[0.08 * S, JAR_R * 0.94]} position={[0, -1.12 * S, 0]} />
    </RigidBody>
  );
}

// ── One issuer-token coin rigid body ─────────────────────────────────────────
// Green cel-shaded coin whose two flat faces carry the issuer's logo (loaded as
// a texture from logo.dev). No logoUrl → plain green disc.
export const R = 0.52; // coin radius
export const HALF_H = 0.07; // half coin thickness

// Hook: load a logo.dev PNG as a texture (null until ready / when no url).
export function useLogoTexture(logoUrl?: string | null) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    setTex(null);
    if (!logoUrl) return;
    let dead = false;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(logoUrl, (t) => {
      if (dead) return;
      t.colorSpace = THREE.SRGBColorSpace;
      setTex(t);
    });
    return () => {
      dead = true;
    };
  }, [logoUrl]);
  return tex;
}

// The coin geometry only (no rigid body) — a translucent glass disc whose two
// faces carry the issuer logo. Reused by the physics Coin and the spinning
// Token3D. Coin axis is +Y (faces point up/down).
export function CoinVisual({ logoUrl, outline = false }: { logoUrl?: string | null; outline?: boolean }) {
  const tex = useLogoTexture(logoUrl);
  return (
    <group>
      {/* Glass rim / body — lit (standard material) so the curved edge catches a
          highlight and the coin reads round, not a flat disc. */}
      <mesh castShadow>
        <cylinderGeometry args={[R, R, HALF_H * 2, 48]} />
        <meshStandardMaterial color="#dff3ff" transparent opacity={0.4} metalness={0.1} roughness={0.3} depthWrite={false} />
        {outline && <Outlines thickness={1.5} color="#9aa3ad" />}
      </mesh>
      {/* Both faces: frosted white disc (so the logo always reads) + logo. Disc is
          lit + slightly domed-looking via a glossy standard material. */}
      {[1, -1].map((s) => (
        <group key={s}>
          <mesh position={[0, (HALF_H + 0.001) * s, 0]} rotation={[(-Math.PI / 2) * s, 0, 0]}>
            <circleGeometry args={[R, 48]} />
            <meshStandardMaterial color="#f4fbff" transparent opacity={0.95} metalness={0.05} roughness={0.4} />
          </mesh>
          {tex && (
            <mesh position={[0, (HALF_H + 0.003) * s, 0]} rotation={[(-Math.PI / 2) * s, 0, 0]}>
              <circleGeometry args={[R, 40]} />
              <meshBasicMaterial map={tex} transparent toneMapped={false} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

export function Coin({
  position,
  logoUrl,
}: {
  position: [number, number, number];
  logoUrl?: string | null;
}) {
  const spin = useMemo<[number, number, number]>(
    () => [Math.random() * 0.6, Math.random() * Math.PI, Math.random() * 0.6],
    [],
  );

  return (
    <RigidBody
      colliders={false}
      position={position}
      rotation={spin}
      ccd
      restitution={0}
      friction={1.2}
      linearDamping={0.6}
      angularDamping={1}
      density={3}
    >
      {/* Explicit cylinder collider = coin shape (hull over multi-mesh group was
          unreliable → coins interpenetrated). A very flat disc (radius ≫ height)
          is unstable in rapier — the solver can't push stacked discs apart and
          they "merge". Give the collider a taller half-height (≈2× the visual) so
          the stack stays separated; coins rest with a small gap, not fused. */}
      <CylinderCollider args={[HALF_H * 2, R]} />
      <CoinVisual logoUrl={logoUrl} />
    </RigidBody>
  );
}
