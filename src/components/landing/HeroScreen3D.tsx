import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, RoundedBox, useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { MotionValue } from "motion/react";
import chatShot from "../../assets/landing/line-chat-shot.png";
import chatHeader from "../../assets/landing/line-chat-header-63e7ba.png";
import chatFooter from "../../assets/landing/line-chat-keyboard-f50c2e.png";

/**
 * The frame, in world units. A hollow rounded rectangle — border only, open
 * through the middle. Nothing that would read as a specific device.
 */
const DEV_W = 2.5;
const DEV_H = 5.6;
const DEV_D = 0.18;
const RADIUS = 0.1;
/** Border thickness. */
const BORDER = 0.075;

/** The opening the screen fills, and the surface the chat is laid out on. */
const W = DEV_W - BORDER * 2;
const H = DEV_H - BORDER * 2;
/** Front of the screen — the slips stack forward from here. */
const FRONT = DEV_D / 2 - 0.03;

/** Slips that fly in and stack on the card during the second act. */
const SLIP_W = 0.62;
const SLIP_H = 0.44;
const SLIPS = [
  { from: [-4.2, 2.6, 2.4], spin: [-0.5, 0.7, 0.5] },
  { from: [4.4, 1.8, 2.8], spin: [0.4, -0.8, -0.4] },
  { from: [-3.8, -2.4, 3.2], spin: [0.6, 0.5, 0.6] },
  { from: [4.0, -2.8, 2.2], spin: [-0.6, -0.5, -0.5] },
  { from: [-2.6, 3.6, 3.4], spin: [0.3, 0.9, 0.3] },
  { from: [2.8, 3.4, 2.6], spin: [-0.35, -0.9, 0.35] },
] as const;

/** Pose the device starts in, turning to face the camera as the hero scrolls. */
const START = { pitch: -0.175, yaw: -0.52, roll: 0 };
const REST = { pitch: 0, yaw: 0, roll: 0 };

/** Hand-set pose, used by the `?hero3d` tuner instead of the scroll. */
export interface PoseOverride {
  pitch: number;
  yaw: number;
  roll: number;
  scale: number;
  lift: number;
  /** 0 → no slips collected, 1 → all of them landed. */
  collect: number;
}

interface Props {
  /** Hero scroll progress, 0 at rest → 1 once the hero has left the viewport. */
  progress: MotionValue<number>;
  reduce: boolean;
  /** When set, the pose comes from here and the scroll is ignored. */
  override?: PoseOverride;
}

/** Rounded-rectangle path, used for both the outline and the hole. */
function roundedRect(path: THREE.Shape | THREE.Path, w: number, h: number, r: number) {
  const x = -w / 2;
  const y = -h / 2;
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + h - r);
  path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h);
  path.quadraticCurveTo(x, y + h, x, y + h - r);
  path.lineTo(x, y + r);
  path.quadraticCurveTo(x, y, x + r, y);
  return path;
}

/**
 * The frame itself: one extruded, bevelled band with the middle cut out, so it
 * reads as a machined border with real thickness and nothing inside it.
 */
function DeviceFrame() {
  const geometry = useMemo(() => {
    const shape = roundedRect(new THREE.Shape(), DEV_W, DEV_H, RADIUS) as THREE.Shape;
    const hole = roundedRect(new THREE.Path(), DEV_W - BORDER * 2, DEV_H - BORDER * 2, RADIUS - BORDER);
    shape.holes.push(hole as THREE.Path);

    const bevel = 0.014;
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: DEV_D - bevel * 2,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 4,
      curveSegments: 24,
    });
    // Extrusion grows along +z from the shape plane; centre it so the frame
    // rotates about its own middle.
    geo.center();
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh geometry={geometry}>
      <meshPhysicalMaterial
        color="#2A3037"
        roughness={0.22}
        metalness={1}
        clearcoat={1}
        clearcoatRoughness={0.08}
        envMapIntensity={2.6}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/** Natural size of the chat capture, for the cover fit below. */
const SHOT_W = 1206;
const SHOT_H = 2622;

/** The status bar + chat header strip, pinned over the top of the screen. */
const HEAD_W = 1206;
const HEAD_H = 317;

/** The rich menu, open over the bottom of the chat. */
const FOOT_W = 1206;
const FOOT_H = 1068;

/**
 * The screen behind the frame's opening: the real LINE chat, as a capture
 * mapped onto a panel. The capture is narrower than the opening, so it is
 * cover-fitted — full width, cropped top and bottom — the way a phone screen
 * shows a scrolling chat.
 */
function Screen() {
  const [texture, header, footer] = useTexture([chatShot, chatHeader, chatFooter]);
  for (const t of [texture, header, footer]) {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
  }

  const visible = useMemo(() => {
    const planeAspect = W / H;
    const shotAspect = SHOT_W / SHOT_H;
    // Match widths, then keep a band of the taller image. The band sits above
    // centre so the flex card clears the rich menu covering the lower half.
    const fraction = Math.min(1, shotAspect / planeAspect);
    const centred = (1 - fraction) / 2;
    return { fraction, offset: Math.min(1 - fraction, centred + 0.12) };
  }, []);
  texture.repeat.set(1, visible.fraction);
  texture.offset.set(0, visible.offset);

  return (
    <group>
      <mesh position={[0, 0, DEV_D / 2 - 0.05]}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      {/* Header strip sits over the chat, the way it stays put while the
          conversation scrolls under it. */}
      <mesh position={[0, H / 2 - (W * HEAD_H) / HEAD_W / 2, DEV_D / 2 - 0.045]}>
        <planeGeometry args={[W, (W * HEAD_H) / HEAD_W]} />
        <meshBasicMaterial map={header} toneMapped={false} />
      </mesh>
      {/* Rich menu, pinned to the bottom the same way. */}
      <mesh position={[0, -H / 2 + (W * FOOT_H) / FOOT_W / 2, DEV_D / 2 - 0.045]}>
        <planeGeometry args={[W, (W * FOOT_H) / FOOT_W]} />
        <meshBasicMaterial map={footer} toneMapped={false} />
      </mesh>
      {/* Backing slab, so the opening is never see-through from an angle. */}
      <RoundedBox args={[W + 0.04, H + 0.04, 0.06]} radius={RADIUS - BORDER + 0.02} smoothness={5} position={[0, 0, -0.02]}>
        <meshStandardMaterial color="#111315" roughness={0.5} />
      </RoundedBox>
    </group>
  );
}

/**
 * One 50-ทวิ slip: a white slab with a tinted header and two ruled lines. Flat
 * enough to stack, detailed enough to read at the size it lands.
 */
function Slip({ index, collect }: { index: number; collect: React.RefObject<number> }) {
  const ref = useRef<THREE.Group>(null);
  const spec = SLIPS[index];

  // Where it comes to rest: fanned onto the card face, each one a little deeper
  // and a little more rotated than the last.
  const target = useMemo(
    () => new THREE.Vector3((index % 2 === 0 ? -0.06 : 0.06), -0.3 + index * 0.015, FRONT + 0.12 + index * 0.012),
    [index],
  );
  const from = useMemo(() => new THREE.Vector3(...spec.from), [spec]);

  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    // Each slip owns a slice of the collect phase, so they arrive one by one.
    const t = THREE.MathUtils.clamp((collect.current - index * 0.1) / 0.45, 0, 1);
    // Ease out — fast entry, soft landing.
    const e = 1 - Math.pow(1 - t, 3);

    g.position.lerpVectors(from, target, e);
    g.rotation.set(
      spec.spin[0] * (1 - e),
      spec.spin[1] * (1 - e),
      spec.spin[2] * (1 - e) + (index % 2 === 0 ? -0.05 : 0.05) * e,
    );
    g.scale.setScalar(1.15 - 0.45 * e);
    g.visible = t > 0;
  });

  return (
    <group ref={ref} visible={false}>
      <RoundedBox args={[SLIP_W, SLIP_H, 0.016]} radius={0.018} smoothness={3}>
        <meshStandardMaterial color="#FFFFFF" roughness={0.45} />
      </RoundedBox>
      <mesh position={[0, SLIP_H / 2 - 0.07, 0.01]}>
        <boxGeometry args={[SLIP_W - 0.06, 0.1, 0.004]} />
        <meshStandardMaterial color="#CEE7FF" roughness={0.5} />
      </mesh>
      {[0.02, -0.08].map((y) => (
        <mesh key={y} position={[-0.06, y, 0.01]}>
          <boxGeometry args={[SLIP_W - 0.22, 0.026, 0.004]} />
          <meshStandardMaterial color="#DDE2EA" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/** How long the device takes to rise into frame on first paint, in seconds. */
const INTRO_S = 1.3;

function Stage({ progress, reduce, override }: Props) {
  const group = useRef<THREE.Group>(null);
  // Entrance: 0 → 1 over INTRO_S, driving the rise from below the viewport.
  const intro = useRef(0);
  // Second act's progress, written once per frame and read by every slip — a
  // ref, so the slips never re-render.
  const collect = useRef(0);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    // Read the scroll MotionValue directly — never through React state, which
    // would re-render this subtree every frame.
    // The tuner poses the device by hand, so it skips the entrance.
    if (override || reduce) intro.current = 1;
    else intro.current = Math.min(1, intro.current + delta / INTRO_S);
    // Ease out back-free: fast start, long settle.
    const enter = 1 - Math.pow(1 - intro.current, 3);

    const raw = progress.get();
    // Act one: the frame turns to face the camera. Act two: slips fly in.
    const p = reduce ? 1 : THREE.MathUtils.clamp(raw / 0.32, 0, 1);
    collect.current = override
      ? override.collect
      : reduce
        ? 1
        : THREE.MathUtils.clamp((raw - 0.36) / 0.5, 0, 1);
    // Frame-rate independent easing towards the scroll-driven pose.
    const k = 1 - Math.pow(0.001, delta);

    const mix = (a: number, b: number) => a + (b - a) * p;
    const targetX = override ? override.pitch : mix(START.pitch, REST.pitch);
    const targetY = override
      ? override.yaw
      : mix(START.yaw, REST.yaw) + (reduce ? 0 : state.pointer.x * 0.1);
    const targetTiltZ = override
      ? override.roll
      : mix(START.roll, REST.roll) - (reduce ? 0 : state.pointer.y * 0.03);
    // Starts big and cropped by the viewport, then pulls back as it turns to
    // face the camera so the whole device is in frame.
    const targetScale = override ? override.scale : 0.74 - p * 0.16;
    // The canvas hangs below the viewport, so at rest the device has to ride
    // well up its own box to sit centred on screen.
    const lift = override ? override.lift : -0.15 + p * 1.15;

    // Rise from below the frame, straightening its extra lean as it arrives.
    const introLift = (1 - enter) * -5.2;
    const introTilt = (1 - enter) * 0.22;

    g.rotation.x += (targetX + introTilt - g.rotation.x) * k;
    g.rotation.y += (targetY - g.rotation.y) * k;
    g.rotation.z += (targetTiltZ - g.rotation.z) * k;
    g.position.y += (lift + introLift - g.position.y) * k;
    g.scale.setScalar(g.scale.x + (targetScale - g.scale.x) * k);
  });

  return (
    <group ref={group} scale={0.74} position={[0, -5.35, 0]}>
      <Screen />
      <DeviceFrame />
      {SLIPS.map((_, i) => (
        <Slip key={i} index={i} collect={collect} />
      ))}
      <ContactShadows position={[0, -DEV_H / 2 - 0.14, 0]} opacity={0.3} scale={7} blur={2.8} far={2.6} resolution={512} />
    </group>
  );
}

/**
 * The hero's product showcase: an empty frame, modelled rather than drawn, so
 * the tilt shows real depth. It turns to face the camera as the hero scrolls.
 *
 * Everything animates by mutating refs inside `useFrame`; the component never
 * sets React state per frame. Under `prefers-reduced-motion` the frame settles
 * square-on and stops tracking the pointer.
 */
export default function HeroScreen3D({ progress, reduce, override }: Props) {
  return (
    <Canvas
      // Cap DPR at 2 — past that the fill cost buys nothing visible.
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ fov: 32, position: [0, 0, 7.6] }}
      // A pure decoration: never let it swallow scrolls or clicks.
      style={{ pointerEvents: "none", background: "transparent" }}
    >
      {/* Lit like the reference: a soft key from the upper left, a hard grazing
          rim from the right to pick out the machined edge, and just enough fill
          that the body doesn't crush to black. */}
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 5, 5]} intensity={0.9} />
      {/* Polished metal needs something to reflect. This environment is built
          in-scene from light panels — no HDR file, nothing fetched at runtime —
          and rendered once, since neither it nor the lights ever move. */}
      <Environment resolution={256} frames={1}>
        {/* Long panel down the left: the bright streak runs along that edge, so
            the right side of the frame falls into shadow. */}
        <Lightformer form="rect" intensity={11} position={[-4, 0, 2]} scale={[1.2, 8, 1]} color="#FFFFFF" />
        {/* Softer fill from the right, tinted like the sky behind the page. */}
        <Lightformer form="rect" intensity={4.5} position={[4.5, 1, 1.5]} scale={[1.6, 8, 1]} color="#CFE0FF" />
        {/* Top and bottom bands so the bevels catch a highlight all the way round. */}
        <Lightformer form="rect" intensity={2.6} rotation-x={Math.PI / 2} position={[0, 5, 0]} scale={[6, 6, 1]} color="#EDF3FF" />
        <Lightformer form="rect" intensity={1.1} rotation-x={-Math.PI / 2} position={[0, -5, 0]} scale={[6, 6, 1]} color="#93A9C7" />
      </Environment>
      {/* The font files load asynchronously. Keep that boundary *inside* the
          Canvas: a Suspense above it would unmount the renderer on every
          suspension and throw the WebGL context away with it. */}
      <Suspense fallback={null}>
        <Stage progress={progress} reduce={reduce} override={override} />
      </Suspense>
    </Canvas>
  );
}
