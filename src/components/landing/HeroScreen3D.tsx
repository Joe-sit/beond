import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, RoundedBox, useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { MotionValue } from "motion/react";
import fileCard from "../../assets/landing/slip-file-card.png";
import chatShot from "../../assets/landing/line-chat-shot.png";
import chatHeader from "../../assets/landing/line-chat-header-63e7ba.png";
import chatFooter from "../../assets/landing/line-chat-keyboard-f50c2e.png";

/**
 * The frame, in world units. A hollow rounded rectangle — border only, open
 * through the middle. Nothing that would read as a specific device.
 */
const DEV_W = 2.5;
const DEV_H = 5.2;
const DEV_D = 0.105;
const RADIUS = 0.16;
/** Border thickness. Hairline — the frame reads as its extruded edge, not as
 *  a bezel around the screen. */
const BORDER = 0.018;

/** The surface the chat is laid out on. It overlaps the frame's front face
 *  rather than sitting inside the opening: dropped into the hole, the front
 *  border and its bevel curve away behind the glass and read as a recess. */
const SCREEN_INSET = 0.004;
const W = DEV_W - SCREEN_INSET * 2;
const H = DEV_H - SCREEN_INSET * 2;
/** Corner radius of the screen layers, following the frame's outer corner. */
const SCREEN_R = RADIUS - SCREEN_INSET;
/** The chat capture sits flush with the frame's front face — set it any
 *  deeper and the screen visibly recesses inside the frame. */
const SCREEN_Z = DEV_D / 2 + 0.0015;

/** Natural size of the file-card art. */
const CARD_W = 399;
const CARD_H = 540;

/** Slip captures that fly in and are swallowed by the screen in the second act.
 *  They travel BEHIND the device — every `from` sits at negative z — so each one
 *  slides out of sight behind the frame instead of crossing over the chat. */
const SLIP_W = 1.25;
const SLIPS = [
  { from: [-5.4, 2.6, -2.2], spin: [-0.5, 0.7, 0.5] },
  { from: [5.6, 1.4, -2.6], spin: [0.4, -0.8, -0.4] },
  { from: [-4.8, -2.6, -3.0], spin: [0.6, 0.5, 0.6] },
  { from: [5.0, -3.0, -2.0], spin: [-0.6, -0.5, -0.5] },
  { from: [-3.2, 4.0, -3.2], spin: [0.3, 0.9, 0.3] },
  { from: [3.6, 3.8, -2.4], spin: [-0.35, -0.9, 0.35] },
] as const;

/** Slice of the collect phase each slip owns, and the stagger between them.
 *  The stagger is derived so the last slip lands exactly at the end of the act
 *  — pick it by hand and either the tail lands off-screen or they pile up. */
const SLIP_SPAN = 0.45;
const SLIP_STEP = (1 - SLIP_SPAN) / (SLIPS.length - 1);
/** Collect progress at which slip `i` is fully swallowed. */
const slipLanded = (i: number) => i * SLIP_STEP + SLIP_SPAN * 0.82;

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
  /** Hero scroll progress, 0 at rest → 1 once the hero has left the viewport.
   *  Sprung, so the device's turn stays smooth. */
  progress: MotionValue<number>;
  /** The same scroll, unsprung. The slips ride this so they track the finger —
   *  through the spring they lag, then several land in one frame and the
   *  device's reaction to them reads as unrelated to the scroll. */
  collect?: MotionValue<number>;
  reduce: boolean;
  /** Story progress, 0 → 1 across the scene sequence that follows the hero.
   *  The same device keeps going through it, drifting side to side, instead of
   *  handing over to a second canvas. */
  story?: MotionValue<number>;
  /** 0 → 1 across the stage's last viewport of scroll, after the story has
   *  finished. The device sinks out of frame over it. */
  exit?: MotionValue<number>;
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
 * A flat rounded-rect panel for the screen layers. The opening has almost no
 * bezel left to hide behind, so a square-cornered plane would poke past the
 * frame's inner arc; these follow it instead. UVs are remapped over the
 * bounding box so a texture maps exactly as it would on a plane.
 */
function roundedPlane(w: number, h: number, r: number, top = true, bottom = true) {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  const cap = Math.min(r, w / 2, h / 2);
  const rb = bottom ? cap : 0;
  const rt = top ? cap : 0;
  shape.moveTo(x + rb, y);
  shape.lineTo(x + w - rb, y);
  if (rb) shape.quadraticCurveTo(x + w, y, x + w, y + rb);
  shape.lineTo(x + w, y + h - rt);
  if (rt) shape.quadraticCurveTo(x + w, y + h, x + w - rt, y + h);
  shape.lineTo(x + rt, y + h);
  if (rt) shape.quadraticCurveTo(x, y + h, x, y + h - rt);
  shape.lineTo(x, y + rb);
  if (rb) shape.quadraticCurveTo(x, y, x + rb, y);

  const geo = new THREE.ShapeGeometry(shape, 12);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);
  }
  uv.needsUpdate = true;
  return geo;
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

    const bevel = 0.009;
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

/** Natural height of the chat capture. Its width matches the opening exactly,
 *  so only the vertical band has to be chosen. */
const SHOT_H = 2622;

/** The chat header strip, pinned over the top of the screen. The capture's top
 *  126px are safe-area padding plus the phone's own iOS status bar (clock,
 *  signal, battery) — crop exactly those off, so the header keeps its full
 *  height and sits flush with the screen's top edge. */
const HEAD_W = 1206;
const HEAD_PAD = 126;
const HEAD_H = 317 - HEAD_PAD;

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
  // Keep the lower band of the header capture — v runs bottom-up, so a repeat
  // shorter than 1 with no offset drops the padding and status bar off the top.
  header.repeat.set(1, HEAD_H / (HEAD_H + HEAD_PAD));
  header.offset.set(0, 0);

  const visible = useMemo(() => {
    // Full width, never trimmed at the sides — the chat's avatars sit right on
    // the edge. Only the capture's own status bar comes off the top; its header
    // row stays, hidden under the strip drawn over it.
    const bodyH = SHOT_H - HEAD_PAD;
    return { repeat: [1, bodyH / SHOT_H] as const, offset: [0, 0] as const };
  }, []);
  texture.repeat.set(visible.repeat[0], visible.repeat[1]);
  texture.offset.set(visible.offset[0], visible.offset[1]);

  const headH = (W * HEAD_H) / HEAD_W;
  const footH = (W * FOOT_H) / FOOT_W;
  const geo = useMemo(() => {
    const r = SCREEN_R;
    return {
      body: roundedPlane(W, H, r),
      head: roundedPlane(W, headH, r, true, false),
      foot: roundedPlane(W, footH, r, false, true),
    };
  }, [headH, footH]);

  return (
    <group>
      <mesh geometry={geo.body} position={[0, 0, SCREEN_Z]}>
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      {/* Header strip sits over the chat, the way it stays put while the
          conversation scrolls under it. */}
      <mesh geometry={geo.head} position={[0, H / 2 - headH / 2, SCREEN_Z + 0.0015]}>
        <meshBasicMaterial map={header} toneMapped={false} />
      </mesh>
      {/* Rich menu, pinned to the bottom the same way. */}
      <mesh geometry={geo.foot} position={[0, -H / 2 + footH / 2, SCREEN_Z + 0.0015]}>
        <meshBasicMaterial map={footer} toneMapped={false} />
      </mesh>
      {/* Backing slab, so the opening is never see-through from an angle. */}
      <RoundedBox args={[DEV_W - BORDER, DEV_H - BORDER, 0.045]} radius={SCREEN_R - BORDER} smoothness={5} position={[0, 0, -0.012]}>
        <meshStandardMaterial color="#111315" roughness={0.5} />
      </RoundedBox>
    </group>
  );
}

/**
 * One captured slip, drawn as the design system's file card: the slip's own
 * thumbnail with its filename on a chip beneath.
 *
 * It flies in from behind the device and is drawn into the screen — the backing
 * slab hides it the moment it arrives, so the shot reads as the chat swallowing
 * the file rather than a card parked on the glass.
 */
function Slip({ index, collect }: { index: number; collect: React.RefObject<number> }) {
  const ref = useRef<THREE.Group>(null);
  const spec = SLIPS[index];
  // Cached by url, so the six of them share one upload.
  const card = useTexture(fileCard);
  card.colorSpace = THREE.SRGBColorSpace;
  card.anisotropy = 8;

  // Where it lands: just behind the screen, so the slab occludes it.
  const target = useMemo(
    () => new THREE.Vector3(index % 2 === 0 ? -0.06 : 0.06, -0.2 + index * 0.02, -0.32),
    [index],
  );
  const from = useMemo(() => new THREE.Vector3(...spec.from), [spec]);

  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    // Each slip owns a slice of the collect phase, so they arrive one by one.
    const t = THREE.MathUtils.clamp((collect.current - index * SLIP_STEP) / SLIP_SPAN, 0, 1);
    // Ease out — fast entry, soft landing.
    const e = 1 - Math.pow(1 - t, 3);

    g.position.lerpVectors(from, target, e);
    g.rotation.set(
      spec.spin[0] * (1 - e),
      spec.spin[1] * (1 - e),
      spec.spin[2] * (1 - e) + (index % 2 === 0 ? -0.05 : 0.05) * e,
    );
    // Shrinks as it is pulled in, so it reads as going away from the viewer.
    g.scale.setScalar(1.1 - 0.62 * e);
    g.visible = t > 0;
  });

  return (
    <group ref={ref} visible={false}>
      <mesh>
        <planeGeometry args={[SLIP_W, (SLIP_W * CARD_H) / CARD_W]} />
        <meshBasicMaterial map={card} transparent toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** How long the device takes to rise into frame on first paint, in seconds. */
const INTRO_S = 1.3;
/** Where the device sits during each story scene: an x offset in world units
 *  and a little yaw, so it turns as it drifts. It swaps sides every scene,
 *  always landing opposite that scene's text. */
const STORY_POSE = [
  // Scenes one and two: the device holds the right half beside the headline,
  // turned onto its edge exactly as it enters in the hero (START).
  { x: 1.75, pitch: START.pitch, yaw: START.yaw, lift: 0.06 },
  { x: 1.55, pitch: START.pitch, yaw: START.yaw, lift: 0.06 },
  // Scenes three and four are carried by flat art, so the device drops away.
  { x: 1.7, pitch: START.pitch, yaw: START.yaw, lift: -4.6 },
  { x: 1.7, pitch: START.pitch, yaw: START.yaw, lift: -6.5 },
] as const;

/** How long the swallow bump takes to play out, in seconds, and how far it
 *  throws the device at the peak. */
const PULSE_S = 0.62;
const PULSE_AMP = 0.11;

function Stage({ progress, collect: collectP, story, exit: exitP, reduce, override }: Props) {
  const group = useRef<THREE.Group>(null);
  // Entrance: 0 → 1 over INTRO_S, driving the rise from below the viewport.
  const intro = useRef(0);
  // Second act's progress, written once per frame and read by every slip — a
  // ref, so the slips never re-render.
  const collect = useRef(0);
  // Swallowing a slip bumps the device. `since` is seconds since the last one
  // arrived — it drives a damped spring, so the bump reads as a real recoil
  // rather than a fade. `landed` remembers the count so each slip fires once.
  const since = useRef(PULSE_S);
  const landed = useRef(0);
  // How hard the last bump hit — a fast scroll can land several at once.
  const strength = useRef(1);
  // The bump multiplies the eased scale, so it has to be divided back out
  // before easing again — otherwise each frame compounds it.
  const bumpApplied = useRef(1);

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
    const p = reduce ? 1 : THREE.MathUtils.clamp(raw / 0.24, 0, 1);
    const rawCollect = collectP ? collectP.get() : raw;
    collect.current = override
      ? override.collect
      : reduce
        ? 1
        : THREE.MathUtils.clamp((rawCollect - 0.42) / 0.5, 0, 1);
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
    const targetScale = override ? override.scale : 0.58 - p * 0.13;

    // Story drift: walk the pose list continuously rather than snapping at
    // scene boundaries, so the device is always on its way somewhere.
    let driftX = 0;
    let driftPitch = 0;
    let driftYaw = 0;
    let driftLift = 0;
    if (story && !override) {
      const s01 = THREE.MathUtils.clamp(story.get(), 0, 1);
      const f = s01 * (STORY_POSE.length - 1);
      const i = Math.min(STORY_POSE.length - 2, Math.floor(f));
      const raw01 = THREE.MathUtils.clamp(f - i, 0, 1);
      // Smoothstep: leaves and arrives at rest, moves fastest mid-way.
      const e = raw01 * raw01 * (3 - 2 * raw01);
      const from = STORY_POSE[i];
      const to = STORY_POSE[i + 1];
      driftX = from.x + (to.x - from.x) * e;
      driftPitch = from.pitch + (to.pitch - from.pitch) * e;
      driftYaw = from.yaw + (to.yaw - from.yaw) * e;
      driftLift = from.lift + (to.lift - from.lift) * e;
      // Phones have no room beside the device: stop drifting sideways and drop
      // it below the scene's text instead. `state.size` is the canvas, which is
      // capped at 900px on every screen — ask the window instead.
      if (window.innerWidth < 1024) {
        driftX = 0;
        driftYaw *= 0.4;
        driftPitch *= 0.4;
        driftLift -= 1.5;
      }
      // The story's progress sits at 0 for the whole hero, so ease the drift in
      // rather than applying scene one's pose from the first frame of the page.
      const ramp = THREE.MathUtils.clamp(s01 / 0.06, 0, 1);
      const rampE = ramp * ramp * (3 - 2 * ramp);
      driftX *= rampE;
      driftPitch *= rampE;
      driftYaw *= rampE;
      driftLift *= rampE;

    }
    // The canvas box overhangs the viewport top and bottom, so the device
    // rides up its own box to sit centred on screen. The box is deliberately
    // taller than the device's travel — clip it any tighter and the top of the
    // frame is cropped by the canvas edge as it lifts.
    const lift = override ? override.lift : -0.25 + p * 1.02;

    // Rise from below the frame, straightening its extra lean as it arrives.
    const introLift = (1 - enter) * -5.2;
    const introTilt = (1 - enter) * 0.22;

    // Count what has arrived and fire one bump per new slip.
    let arrived = 0;
    for (let i = 0; i < SLIPS.length; i++) if (collect.current >= slipLanded(i)) arrived++;
    if (arrived > landed.current) {
      since.current = 0;
      strength.current = Math.min(2, arrived - landed.current);
    }
    landed.current = arrived;
    since.current = Math.min(PULSE_S, since.current + delta);
    // Damped spring: a fast swell, one small settle back, then nothing.
    const u = since.current / PULSE_S;
    const bump = reduce ? 1 : 1 + PULSE_AMP * strength.current * Math.sin(u * Math.PI * 2.6) * Math.exp(-4.5 * u);

    // The sticky layer stays pinned while the section below scrolls up under
    // it, so sink the device out of frame over that last stretch instead of
    // leaving it parked on top of the next section.
    if (exitP && !override) {
      const exit = THREE.MathUtils.clamp(exitP.get(), 0, 1);
      driftLift -= exit * exit * 7;
    }

    g.rotation.x += (targetX + driftPitch + introTilt - g.rotation.x) * k;
    g.rotation.y += (targetY + driftYaw - g.rotation.y) * k;
    g.rotation.z += (targetTiltZ - g.rotation.z) * k;
    g.position.y += (lift + driftLift + introLift - g.position.y) * k;
    g.position.x += (driftX - g.position.x) * k;
    const eased = g.scale.x / (bumpApplied.current || 1);
    const next = eased + (targetScale - eased) * k;
    bumpApplied.current = bump;
    g.scale.setScalar(next * bump);
  });

  return (
    <group ref={group} scale={0.58} position={[0, -5.67, 0]}>
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
export default function HeroScreen3D({ progress, collect, story, exit, reduce, override }: Props) {
  return (
    <Canvas
      // Cap DPR at 2 — past that the fill cost buys nothing visible.
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ fov: 32, position: [0, 0, 7.6] }}
      // A pure decoration: never let it swallow scrolls or clicks.
      style={{ pointerEvents: "none", background: "transparent" }}
    >
      {/* Lit like the reference: a soft key from the upper right, a hard grazing
          rim to pick out the machined edge, and just enough fill that the body
          doesn't crush to black. */}
      <ambientLight intensity={0.35} />
      <directionalLight position={[-4, 5, 5]} intensity={0.9} />
      {/* Polished metal needs something to reflect. This environment is built
          in-scene from light panels — no HDR file, nothing fetched at runtime —
          and rendered once, since neither it nor the lights ever move. */}
      <Environment resolution={256} frames={1}>
        {/* Key streak for the right-hand extrusion. The device is turned away
            from the camera on that side, so a mirror face there reflects
            BEHIND the scene — a panel in front of the device never lands on
            it. Hence +x but -z. */}
        <Lightformer form="rect" intensity={14} position={[5, 0.5, -2.6]} scale={[1.4, 9, 1]} color="#FFFFFF" />
        {/* Second streak further round, so the edge keeps its highlight as the
            device turns square-on. */}
        <Lightformer form="rect" intensity={7} position={[2, 0, -5]} scale={[2.4, 9, 1]} color="#F2F7FF" />
        {/* Softer fill from the left, tinted like the sky behind the page. */}
        <Lightformer form="rect" intensity={4.5} position={[-4.5, 1, 1.5]} scale={[1.6, 8, 1]} color="#CFE0FF" />
        {/* Top and bottom bands so the bevels catch a highlight all the way round. */}
        <Lightformer form="rect" intensity={2.6} rotation-x={Math.PI / 2} position={[0, 5, 0]} scale={[6, 6, 1]} color="#EDF3FF" />
        <Lightformer form="rect" intensity={1.1} rotation-x={-Math.PI / 2} position={[0, -5, 0]} scale={[6, 6, 1]} color="#93A9C7" />
      </Environment>
      {/* The font files load asynchronously. Keep that boundary *inside* the
          Canvas: a Suspense above it would unmount the renderer on every
          suspension and throw the WebGL context away with it. */}
      <Suspense fallback={null}>
        <Stage progress={progress} collect={collect} story={story} exit={exit} reduce={reduce} override={override} />
      </Suspense>
    </Canvas>
  );
}
