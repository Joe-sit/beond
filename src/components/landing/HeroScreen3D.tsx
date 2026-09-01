import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, RoundedBox, useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { MotionValue } from "motion/react";
import fileCard from "../../assets/landing/slip-file-card.png";
import LineChat, { SCREEN_H, SCREEN_W } from "./line/LineChat";

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
const slipLanded = (i: number) => i * SLIP_STEP + SLIP_SPAN * 0.9;

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
  /** 0 → 1 through the chat on the device's screen, so the page's scroll walks
   *  the conversation from the first slip to the interest calendar. */
  chat?: MotionValue<number>;
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

/**
 * The screen behind the frame's opening: the real LINE chat, as a capture
 * mapped onto a panel. The capture is narrower than the opening, so it is
 * cover-fitted — full width, cropped top and bottom — the way a phone screen
 * shows a scrolling chat.
 */
/**
 * The screen: the real beond chat, rendered as DOM and mapped onto the front
 * of the device by drei's <Html transform>.
 *
 * It used to be a screenshot. A screenshot can only ever say one thing, and
 * the page has a whole product to walk through — so the phone runs the actual
 * LINE conversation instead, and `chat` scrolls it as the page scrolls.
 *
 * The DOM sits over the canvas rather than in it: the slips fly in *behind*
 * the device, which is what we want the screen to hide anyway, and nothing
 * ever passes in front of it.
 */
/** The chat is laid out at `W` — the frame's outer width — but it has to land
 *  inside the frame's opening, not on top of its border, or the black header
 *  paints over the corners. This shrinks it onto the opening; the opening is a
 *  touch taller than the chat's 390:812, so a hair of the backing slab shows
 *  above and below and reads as bezel. */
const SCREEN_FIT = (DEV_W - BORDER * 2) / W;
/** The screen's size in world units. */
const SCREEN_WORLD_W = W * SCREEN_FIT;
const SCREEN_WORLD_H = (SCREEN_WORLD_W * SCREEN_H) / SCREEN_W;

/**
 * The chat's four corners in the device's own space, in the order the
 * projection below wants them: (0,0), (1,0), (1,1), (0,1) of the DOM box.
 */
const SCREEN_CORNERS = [
  new THREE.Vector3(-SCREEN_WORLD_W / 2, SCREEN_WORLD_H / 2, SCREEN_Z),
  new THREE.Vector3(SCREEN_WORLD_W / 2, SCREEN_WORLD_H / 2, SCREEN_Z),
  new THREE.Vector3(SCREEN_WORLD_W / 2, -SCREEN_WORLD_H / 2, SCREEN_Z),
  new THREE.Vector3(-SCREEN_WORLD_W / 2, -SCREEN_WORLD_H / 2, SCREEN_Z),
] as const;

const corner = new THREE.Vector3();

/**
 * Lay a DOM element over four projected points.
 *
 * drei's `<Html transform>` does this with a CSS 3D scene of its own — a
 * `perspective` on the wrapper and the camera's matrix on a parent layer. That
 * mirrors the WebGL camera rather than deriving from it, and the two drift
 * apart: on short viewports the chat painted ~46px below the frame it is
 * supposed to be inside, at every pose and every scroll position.
 *
 * So the screen is projected instead of mirrored. The device's four screen
 * corners go through the same camera the frame is rendered with, and the DOM
 * box is mapped onto them with a plane projective transform — the CSS cannot
 * disagree with the render, because it is derived from it.
 *
 * `q` are the destination points in canvas pixels, clockwise from the top-left.
 * Solves the unit square → quad map (Heckbert, *Fundamentals of Texture
 * Mapping and Image Warping*, §2.2), then pre-scales it by the box's own size.
 */
function quadTransform(q: number[][], w: number, h: number): string | null {
  const [p0, p1, p2, p3] = q;
  const dx1 = p1[0] - p2[0];
  const dx2 = p3[0] - p2[0];
  const dy1 = p1[1] - p2[1];
  const dy2 = p3[1] - p2[1];
  const det = dx1 * dy2 - dx2 * dy1;
  if (!det) return null;
  const sx = p0[0] - p1[0] + p2[0] - p3[0];
  const sy = p0[1] - p1[1] + p2[1] - p3[1];
  const g = (sx * dy2 - dx2 * sy) / det;
  const i = (dx1 * sy - sx * dy1) / det;
  const a = p1[0] - p0[0] + g * p1[0];
  const b = p3[0] - p0[0] + i * p3[0];
  const c = p0[0];
  const d = p1[1] - p0[1] + g * p1[1];
  const e = p3[1] - p0[1] + i * p3[1];
  const f = p0[1];
  // Columns are the transform's basis vectors, so dividing the first by the
  // box width and the second by its height folds in the box → unit square step.
  return `matrix3d(${a / w},${d / w},0,${g / w},${b / h},${e / h},0,${i / h},0,0,1,0,${c},${f},0,1)`;
}

/**
 * The chat is DOM, so it is rendered beside the canvas (see `HeroScreen3D`)
 * rather than inside it, and `Stage` poses it every frame. In here only the
 * backing slab is left: the mesh that keeps the opening from being
 * see-through when the device turns.
 */
function Screen() {
  return (
    <RoundedBox args={[DEV_W - BORDER, DEV_H - BORDER, 0.045]} radius={SCREEN_R - BORDER} smoothness={5} position={[0, 0, -0.012]}>
      <meshStandardMaterial color="#111315" roughness={0.5} />
    </RoundedBox>
  );
}

/** The DOM screen, laid over the canvas and posed by `Stage`. */
function ScreenLayer({ screen, chat }: { screen: React.Ref<HTMLDivElement>; chat?: MotionValue<number> }) {
  return (
    <div
      ref={screen}
      aria-hidden
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: SCREEN_W,
        height: SCREEN_H,
        transformOrigin: "0 0",
        // The matrix below is rewritten every frame, and this subtree is a
        // whole chat: cards, images, shadows, Thai type. Without these it is
        // repainted on the main thread each frame — the scroll keeps moving
        // (it is composited) while the device visibly stops updating. These
        // give it its own layer and stop its paint from being re-evaluated
        // against the rest of the page.
        willChange: "transform",
        backfaceVisibility: "hidden",
        contain: "layout paint style",
        visibility: "hidden",
        overflow: "hidden",
        pointerEvents: "none",
        borderRadius: (SCREEN_R / W) * SCREEN_W,
      }}
    >
      <LineChat progress={chat} />
    </div>
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
  { x: 1.35, pitch: START.pitch, yaw: START.yaw, lift: 0.06 },
  { x: 1.2, pitch: START.pitch, yaw: START.yaw, lift: 0.06 },
  // Scenes three and four are carried by flat art, so the device drops away.
  { x: 1.3, pitch: START.pitch, yaw: START.yaw, lift: -4.6 },
  { x: 1.3, pitch: START.pitch, yaw: START.yaw, lift: -6.5 },
] as const;

/** How much smaller the device reads once the story takes over: it shares the
 *  scene with a headline now, where in the hero it had the stage to itself. */
const STORY_SCALE = 0.74;

/** The swallow bump is driven by the scroll, not by a clock: `PULSE_SPAN` is
 *  how much of the collect phase one recoil plays over, `PULSE_AMP` how far it
 *  throws the device at the peak. Tying it to the scroll keeps it locked to the
 *  card that caused it — a slow scroll swells slowly, a scroll back up rewinds
 *  the recoil with the card. */
const PULSE_SPAN = 0.085;
const PULSE_AMP = 0.13;

function Stage({ progress, collect: collectP, story, exit: exitP, screen, reduce, override }: Props & { screen: React.RefObject<HTMLDivElement | null> }) {
  const group = useRef<THREE.Group>(null);
  // Last matrix written to the screen. Rewriting an identical transform still
  // dirties the layer, so a settled device costs nothing.
  const posed = useRef("");
  // Entrance: 0 → 1 over INTRO_S, driving the rise from below the viewport.
  const intro = useRef(0);
  // Second act's progress, written once per frame and read by every slip — a
  // ref, so the slips never re-render.
  const collect = useRef(0);
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
    let targetScale = override ? override.scale : 0.58 - p * 0.13;

    // Story drift: walk the pose list continuously rather than snapping at
    // scene boundaries, so the device is always on its way somewhere.
    let driftX = 0;
    let driftPitch = 0;
    let driftYaw = 0;
    let driftLift = 0;
    let storyMix = 0;
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
      storyMix = rampE;
    }
    if (!override) {
      targetScale *= 1 + (STORY_SCALE - 1) * storyMix;
      // Keep the device inside its canvas whatever shape the window is. The
      // stage is capped at 900px wide but its height follows the viewport, so
      // a tall window leaves very little horizontal room in world units and
      // the drift would otherwise run the device off the right edge.
      const halfStage = state.viewport.width / 2;
      const halfDevice = (DEV_W * Math.cos(START.yaw) + DEV_D) * 0.5 * targetScale;
      const limit = Math.max(0, halfStage - halfDevice - 0.1);
      driftX = THREE.MathUtils.clamp(driftX, -limit, limit);
    }
    // The canvas box overhangs the viewport top and bottom, so the device
    // rides up its own box to sit centred on screen. The box is deliberately
    // taller than the device's travel — clip it any tighter and the top of the
    // frame is cropped by the canvas edge as it lifts.
    const lift = override ? override.lift : -0.25 + p * 0.6;

    // Rise from below the frame, straightening its extra lean as it arrives.
    const introLift = (1 - enter) * -5.2;
    const introTilt = (1 - enter) * 0.22;

    // One damped recoil per slip, each read straight off the collect progress
    // at the point its card vanishes behind the screen. They sum, so a fast
    // scroll that lands several at once hits harder.
    let bump = 1;
    if (!reduce) {
      for (let i = 0; i < SLIPS.length; i++) {
        const u = (collect.current - slipLanded(i)) / PULSE_SPAN;
        if (u <= 0 || u >= 1) continue;
        bump += PULSE_AMP * Math.sin(u * Math.PI * 2.6) * Math.exp(-4.5 * u);
      }
    }

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

    // Lay the DOM screen over the frame it belongs to. The pose was written a
    // few lines up, so refresh this group's world matrix rather than waiting
    // for the renderer's own pass — otherwise the chat trails the frame by a
    // frame while the device moves.
    const el = screen.current;
    if (el) {
      g.updateWorldMatrix(true, false);
      const q: number[][] = [];
      let ok = true;
      for (const c of SCREEN_CORNERS) {
        corner.copy(c).applyMatrix4(g.matrixWorld);
        // Behind the camera: the projection folds over, so drop the frame.
        if (corner.z > state.camera.position.z - state.camera.near) ok = false;
        corner.project(state.camera);
        q.push([
          (corner.x * 0.5 + 0.5) * state.size.width,
          (-corner.y * 0.5 + 0.5) * state.size.height,
        ]);
      }
      const m = ok ? quadTransform(q, SCREEN_W, SCREEN_H) : null;
      if (m) {
        if (m !== posed.current) {
          posed.current = m;
          el.style.transform = m;
        }
        el.style.visibility = "visible";
      } else {
        el.style.visibility = "hidden";
      }
    }
    // Priority -1 keeps this ahead of any other per-frame work in the scene,
    // so the pose and the screen laid over it are always the same frame's.
  }, -1);

  return (
    <group ref={group} scale={0.58} position={[0, -5.67, 0]}>
      <Screen />
      <DeviceFrame />
      {SLIPS.map((_, i) => (
        <Slip key={i} index={i} collect={collect} />
      ))}
      {/* The shadow re-renders its own depth pass every frame. At 512 that is a
          second full pass for something the page reads as a soft smudge. */}
      <ContactShadows position={[0, -DEV_H / 2 - 0.14, 0]} opacity={0.3} scale={7} blur={2.8} far={2.6} resolution={256} />
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
export default function HeroScreen3D({ progress, collect, story, exit, chat, reduce, override }: Props) {
  // The chat is a DOM layer over the canvas, not a texture inside it, so that
  // every Flex card stays real type. `Stage` projects the device's screen
  // corners through the camera each frame and maps this element onto them.
  const screen = useRef<HTMLDivElement>(null);
  return (
    <div className="relative h-full w-full">
    <Canvas
      // Cap DPR at 1.5. The device is a soft-edged render behind a DOM screen
      // that carries all the detail, so the extra fill of a full 2x buys
      // almost nothing and costs a lot on a retina laptop.
      dpr={[1, 1.5]}
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
        <Stage
          progress={progress}
          collect={collect}
          story={story}
          exit={exit}
          screen={screen}
          reduce={reduce}
          override={override}
        />
      </Suspense>
    </Canvas>
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <ScreenLayer screen={screen} chat={chat} />
    </div>
    </div>
  );
}
