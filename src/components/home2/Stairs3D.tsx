// Real CSS-3D staircase — hero-stairs.svg rebuilt as a SOLID stepped mass. Each
// step is a full-height cuboid rising from the ground (step i is (i+1)·rise tall)
// set one tread further back, so taller boxes peek above nearer ones and the
// whole thing reads as one solid staircase (no see-through gaps) — matching the
// SVG's solid grey side + white steps. Geometry + camera tunable via ?stairs.
export interface StairStep {
  label?: string;
  refundZone?: boolean;
}

// hero palette, lit from above: tread brightest, riser (front) mid, side grey.
const HERO = { top: "#FDFDFE", riser: "#EDEDF1", side: "#D6D6DC" };
const GREEN = { top: "#8FD6A6", riser: "#5FB97E", side: "#4CA46B" };
const GREY = { top: "#EDEDF0", riser: "#D9D9DE", side: "#C7C7CF" };
const ACTIVE = { top: "#FFD98A", riser: "#F5A623", side: "#DB8E10" };

function faceStyle(): React.CSSProperties {
  return { position: "absolute", left: "50%", top: "50%", border: "1px solid rgba(0,0,0,0.04)" };
}

function Step({
  i, step, active, hero, play, w, tread, rise, depth,
}: {
  i: number; step: StairStep; active: boolean; hero: boolean; play: boolean;
  w: number; tread: number; rise: number; depth: number;
}) {
  const pal = hero ? HERO : active ? ACTIVE : step.refundZone ? GREEN : GREY;
  const H = (i + 1) * rise; // full height from the ground
  const zFront = -i * tread; // this step's front plane (recedes by the stacking pitch)
  const cz = zFront - depth / 2; // box centre in z (depth = this step's own run)
  const f = faceStyle();
  // Climb-in: each step drops from above + fades, staggered bottom→top. Wrapper
  // keeps preserve-3d so the box faces retain real depth.
  const anim: React.CSSProperties = {
    transformStyle: "preserve-3d",
    opacity: play ? 1 : 0,
    transform: play ? "translateY(0)" : "translateY(-40px)",
    transition: `opacity 420ms ease ${i * 80}ms, transform 520ms cubic-bezier(.34,1.4,.5,1) ${i * 80}ms`,
  };
  return (
    <div style={anim}>
      {/* front (riser) — full height so fronts stack into a solid wall */}
      <div
        style={{
          ...f, width: w, height: H, marginLeft: -w / 2, marginTop: -H / 2,
          background: pal.riser,
          transform: `translateY(${-H / 2}px) translateZ(${zFront}px)`,
          boxShadow: active ? "0 0 0 2px #F5A623" : undefined,
        }}
      >
        {step.label && (
          <span className="font-nunito font-extrabold text-white" style={{ position: "absolute", left: 0, right: 0, bottom: 6, textAlign: "center", fontSize: 15, textShadow: "0 1px 2px rgba(0,0,0,.25)" }}>
            {step.label}
          </span>
        )}
      </div>
      {/* tread (top) */}
      <div
        style={{
          ...f, width: w, height: depth, marginLeft: -w / 2, marginTop: -depth / 2,
          background: pal.top,
          transform: `translateY(${-H}px) translateZ(${cz}px) rotateX(90deg)`,
        }}
      />
      {/* left side */}
      <div
        style={{
          ...f, width: depth, height: H, marginLeft: -depth / 2, marginTop: -H / 2,
          background: pal.side,
          transform: `translateX(${-w / 2}px) translateY(${-H / 2}px) translateZ(${cz}px) rotateY(90deg)`,
        }}
      />
      {/* right side */}
      <div
        style={{
          ...f, width: depth, height: H, marginLeft: -depth / 2, marginTop: -H / 2,
          background: pal.side,
          transform: `translateX(${w / 2}px) translateY(${-H / 2}px) translateZ(${cz}px) rotateY(90deg)`,
        }}
      />
    </div>
  );
}

export default function Stairs3D({
  steps,
  activeIndex = -1,
  hero = false,
  play = true,
  rx = 0,
  ry = -42,
  rz = 0,
  persp = 2081,
  scale = 1,
  w = 387,
  tread = 51,
  rise = 40,
  topTreadMul = 1,
  flag = false,
}: {
  steps: StairStep[];
  activeIndex?: number;
  hero?: boolean;
  play?: boolean;
  rx?: number;
  ry?: number;
  rz?: number;
  persp?: number;
  scale?: number;
  w?: number;
  tread?: number;
  rise?: number;
  topTreadMul?: number; // deepen the top step's run into a landing platform
  flag?: boolean; // plant a "steps to success" flag on the top step
}) {
  const n = steps.length;
  const Htop = n * rise;
  const zTop = -(n - 1) * tread - tread / 2; // centre of the top tread in z
  const poleH = Math.max(48, rise * 1.6);
  return (
    <div style={{ perspective: persp }}>
      <div
        className="relative"
        style={{ transformStyle: "preserve-3d", transform: `scale(${scale}) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)` }}
      >
        {steps.map((s, i) => (
          <Step key={i} i={i} step={s} active={i === activeIndex} hero={hero} play={play} w={w} tread={tread} rise={rise} depth={i === n - 1 ? tread * topTreadMul : tread} />
        ))}
        {flag && (
          <div style={{ position: "absolute", left: "50%", top: "50%", transformStyle: "preserve-3d", opacity: play ? 1 : 0, transition: `opacity 400ms ease ${n * 80 + 300}ms` }}>
            {/* pole — stands vertically on the top tread */}
            <div style={{ position: "absolute", left: 0, top: 0, width: 4, height: poleH, marginLeft: -2, marginTop: -poleH, background: "#FFFFFF", borderRadius: 2, transform: `translateY(${-Htop}px) translateZ(${zTop}px)` }} />
            {/* pennant */}
            <div style={{ position: "absolute", left: 0, top: 0, width: 42, height: 26, marginTop: -poleH, background: "#FFFFFF", clipPath: "polygon(0 0, 100% 50%, 0 100%)", transform: `translateY(${-Htop}px) translateZ(${zTop}px) translateX(2px)` }} />
          </div>
        )}
      </div>
    </div>
  );
}
