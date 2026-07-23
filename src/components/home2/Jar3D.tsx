import { useEffect, useMemo, useState } from "react";
import { RigidBody, CuboidCollider, CylinderCollider } from "@react-three/rapier";
import * as THREE from "three";

// Real 3D mason money jar (three.js / rapier), illustrated 2.5D look: flat toon
// shading + black outlines. Body is a surface-of-revolution (LatheGeometry) so it
// has the classic jar silhouette — wide body, curved shoulder, narrow neck, lip.
// Render inside a <Canvas> wrapped in <Physics>. Coins fall in and pile up.

export const JAR_R = 1;
export const JAR_H = 2.4;
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
    <group>
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
  const hw = JAR_R * Math.tan(Math.PI / N) * 1.15; // wall half-width (+overlap)
  const wallH = (BODY_TOP + 1.2) / 2; // wall spans the straight body only
  return (
    <RigidBody type="fixed" colliders={false}>
      {Array.from({ length: N }).map((_, i) => {
        const a = (i / N) * Math.PI * 2;
        return (
          <CuboidCollider
            key={i}
            args={[hw, wallH, 0.04]}
            position={[Math.sin(a) * JAR_R, -1.2 + wallH, Math.cos(a) * JAR_R]}
            rotation={[0, a, 0]}
          />
        );
      })}
      <CylinderCollider args={[0.08, JAR_R * 0.94]} position={[0, -1.12, 0]} />
    </RigidBody>
  );
}

// ── One issuer-token coin rigid body ─────────────────────────────────────────
// Green cel-shaded coin whose two flat faces carry the issuer's logo (loaded as
// a texture from logo.dev). No logoUrl → plain green disc.
const R = 0.44; // coin radius
const HALF_H = 0.06; // half coin thickness

export function Coin({
  position,
  logoUrl,
}: {
  position: [number, number, number];
  logoUrl?: string | null;
}) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const spin = useMemo<[number, number, number]>(
    () => [Math.random() * 0.6, Math.random() * Math.PI, Math.random() * 0.6],
    [],
  );

  useEffect(() => {
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

  return (
    <RigidBody
      colliders={false}
      position={position}
      rotation={spin}
      ccd
      restitution={0.03}
      friction={1}
      linearDamping={0.5}
      angularDamping={0.8}
      density={8}
    >
      {/* Explicit cylinder collider = coin shape (hull over multi-mesh group was
          unreliable → coins interpenetrated). Rotates with the RigidBody. */}
      <CylinderCollider args={[HALF_H, R]} />
      <group>
        {/* Translucent glass rim / body + black silhouette outline. */}
        <mesh castShadow>
          <cylinderGeometry args={[R, R, HALF_H * 2, 32]} />
          <meshBasicMaterial color="#dff3ff" transparent opacity={0.28} depthWrite={false} />
        </mesh>
        {/* Both faces: frosted white disc (so the logo always reads) + logo. */}
        {[1, -1].map((s) => (
          <group key={s}>
            <mesh position={[0, (HALF_H + 0.001) * s, 0]} rotation={[(-Math.PI / 2) * s, 0, 0]}>
              <circleGeometry args={[R, 40]} />
              <meshBasicMaterial color="#f4fbff" transparent opacity={0.92} toneMapped={false} />
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
    </RigidBody>
  );
}
