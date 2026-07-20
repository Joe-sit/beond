import { useRef, useState } from "react";

// Interactive 3D-cuboid playground. Drag to orbit, sliders to tune every
// dimension + the camera, live debug readout of the exact values. Use it to dial
// in numbers for the building chart, then hand the values back. View at ?cube.

interface Vals {
  rx: number;
  ry: number;
  rz: number;
  persp: number;
  w: number;
  h: number;
  d: number;
}

const INIT: Vals = { rx: -5, ry: 45, rz: 0, persp: 2600, w: 137, h: 320, d: 137 };

const FACES = [
  { key: "front", label: "FRONT", color: "#5E9129", tf: (v: Vals) => `translateZ(${v.d / 2}px)`, size: (v: Vals) => [v.w, v.h] },
  { key: "back", label: "BACK", color: "#3f6a1c", tf: (v: Vals) => `rotateY(180deg) translateZ(${v.d / 2}px)`, size: (v: Vals) => [v.w, v.h] },
  { key: "right", label: "RIGHT", color: "#80BA44", tf: (v: Vals) => `rotateY(90deg) translateZ(${v.w / 2}px)`, size: (v: Vals) => [v.d, v.h] },
  { key: "left", label: "LEFT", color: "#6ba336", tf: (v: Vals) => `rotateY(-90deg) translateZ(${v.w / 2}px)`, size: (v: Vals) => [v.d, v.h] },
  { key: "top", label: "TOP", color: "#9BCB6A", tf: (v: Vals) => `rotateX(90deg) translateZ(${v.h / 2}px)`, size: (v: Vals) => [v.w, v.d] },
  { key: "bottom", label: "BOTTOM", color: "#7ba84e", tf: (v: Vals) => `rotateX(-90deg) translateZ(${v.h / 2}px)`, size: (v: Vals) => [v.w, v.d] },
] as const;

function Row({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-24 shrink-0 font-mono text-ink/70">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1" />
      <input type="number" value={value} step={step} onChange={(e) => onChange(Number(e.target.value))} className="w-20 rounded border border-black/15 px-2 py-1 font-mono text-ink" />
    </label>
  );
}

export default function CubePOC() {
  const [v, setV] = useState<Vals>(INIT);
  const set = (k: keyof Vals) => (n: number) => setV((p) => ({ ...p, [k]: n }));
  const drag = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);

  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, rx: v.rx, ry: v.ry };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const dr = drag.current;
    if (!dr) return;
    setV((p) => ({ ...p, ry: dr.ry + (e.clientX - dr.x) * 0.5, rx: dr.rx - (e.clientY - dr.y) * 0.5 }));
  };
  const onUp = () => (drag.current = null);

  const readout = `rotateX(${v.rx}deg) rotateY(${v.ry}deg) rotateZ(${v.rz}deg) · perspective ${v.persp}px · W${v.w} H${v.h} D${v.d}`;

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-[#779BC6] to-white font-kanit">
      {/* Stage */}
      <div
        className="relative flex-1 cursor-grab touch-none select-none active:cursor-grabbing"
        style={{ perspective: v.persp }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div
          className="absolute left-1/2 top-1/2"
          style={{ transformStyle: "preserve-3d", transform: `translate(-50%, -50%) rotateX(${v.rx}deg) rotateY(${v.ry}deg) rotateZ(${v.rz}deg)` }}
        >
          {FACES.map((f) => {
            const [fw, fh] = f.size(v);
            return (
              <div
                key={f.key}
                className="absolute left-1/2 top-1/2 flex items-center justify-center text-xs font-bold text-white/90"
                style={{
                  width: fw,
                  height: fh,
                  marginLeft: -fw / 2,
                  marginTop: -fh / 2,
                  background: f.color,
                  border: "1px solid rgba(255,255,255,0.35)",
                  transform: f.tf(v),
                  backfaceVisibility: "visible",
                }}
              >
                {f.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="shrink-0 space-y-2 border-t border-black/10 bg-white/90 p-5 backdrop-blur">
        <p className="mb-2 font-mono text-xs text-ink/60">drag stage to orbit · {readout}</p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <Row label="rotateX" value={v.rx} min={-90} max={90} step={1} onChange={set("rx")} />
          <Row label="rotateY" value={v.ry} min={-90} max={90} step={1} onChange={set("ry")} />
          <Row label="rotateZ" value={v.rz} min={-45} max={45} step={1} onChange={set("rz")} />
          <Row label="perspective" value={v.persp} min={400} max={5000} step={50} onChange={set("persp")} />
          <Row label="W (width)" value={v.w} min={40} max={300} step={1} onChange={set("w")} />
          <Row label="H (height)" value={v.h} min={40} max={600} step={1} onChange={set("h")} />
          <Row label="D (depth)" value={v.d} min={40} max={300} step={1} onChange={set("d")} />
        </div>
        <button onClick={() => setV(INIT)} className="mt-1 rounded-lg bg-black/5 px-3 py-1.5 text-sm text-ink hover:bg-black/10">
          reset
        </button>
      </div>
    </div>
  );
}
