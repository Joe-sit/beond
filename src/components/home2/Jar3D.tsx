import { useEffect, useMemo, useState } from "react";
import { RigidBody, CuboidCollider, CylinderCollider } from "@react-three/rapier";
import { Outlines } from "@react-three/drei";
import * as THREE from "three";

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
