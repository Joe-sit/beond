import { useRef, useState } from "react";
import Stairs3D from "./Stairs3D";
import { buildStairsSvg } from "./stairsToSvg";

// ?stairs — full tuner for the real-3D hero staircase (rebuild of
// hero-stairs.svg). Drag the stage to orbit (rotateX/Y), or use the sliders for
// every camera + geometry parameter. The param line at the bottom is ready to
// paste into <Stairs3D …> once a look is dialled in.
export default function HeroStairs3D() {
  const [rx, setRx] = useState(0);
  const [ry, setRy] = useState(-42);
  const [rz, setRz] = useState(0);
  const [persp, setPersp] = useState(2081);
  const [scale, setScale] = useState(1.0);
  const [w, setW] = useState(387);
  const [tread, setTread] = useState(51);
  const [rise, setRise] = useState(40);
  const [count, setCount] = useState(6);

  // Free camera. Drag → orbit (horizontal = rotateY, vertical = rotateX).
  // Shift+drag → roll (rotateZ). Mouse wheel → zoom (scale).
  const drag = useRef<{ x: number; y: number; rx: number; ry: number; rz: number; roll: boolean } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, rx, ry, rz, roll: e.shiftKey };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  // Wrap into −180..180 so a full 360° orbit stays in range.
  const wrap = (n: number) => ((((n + 180) % 360) + 360) % 360) - 180;
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.roll) {
      setRz(wrap(Math.round(d.rz + (e.clientX - d.x) * 0.4)));
      return;
    }
    setRy(wrap(Math.round(d.ry + (e.clientX - d.x) * 0.4)));
    setRx(wrap(Math.round(d.rx - (e.clientY - d.y) * 0.4)));
  };
  const onUp = () => { drag.current = null; };
  const onWheel = (e: React.WheelEvent) => {
    setScale((s) => Math.min(3, Math.max(0.3, +(s - e.deltaY * 0.001).toFixed(2))));
  };

  // Camera presets — pick one, then fine-tune with the sliders.
  const MODES: Record<string, { rx: number; ry: number; rz: number }> = {
    "Isometric": { rx: 35, ry: -45, rz: 0 },
    "Dimetric (SVG)": { rx: 0, ry: -42, rz: 0 },
    "Front": { rx: 0, ry: 0, rz: 0 },
    "Side": { rx: 0, ry: -90, rz: 0 },
    "Top-down": { rx: 80, ry: 0, rz: 0 },
  };
  const applyMode = (name: string) => {
    const m = MODES[name];
    if (!m) return;
    setRx(m.rx); setRy(m.ry); setRz(m.rz);
  };

  const Row = ({ label, v, set, min, max }: { label: string; v: number; set: (n: number) => void; min: number; max: number }) => (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-24 font-mono text-ink/70">{label}</span>
      <input type="range" min={min} max={max} value={v} onChange={(e) => set(Number(e.target.value))} className="flex-1" />
      <span className="w-14 font-mono text-ink">{v}</span>
    </label>
  );

  const param = `rx={${rx}} ry={${ry}} rz={${rz}} persp={${persp}} scale={${scale}} w={${w}} tread={${tread}} rise={${rise}}`;

  const exportSvg = () => {
    const svg = buildStairsSvg({ rx, ry, rz, persp, scale, w, tread, rise, count });
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "hero-stairs-3d.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-linear-to-b from-[#779BC6] to-[#F6F4F1] font-kanit">
      <div
        className="flex flex-1 cursor-grab items-center justify-center touch-none active:cursor-grabbing"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onWheel={onWheel}
      >
        <Stairs3D
          steps={Array.from({ length: count }, () => ({}))}
          hero rx={rx} ry={ry} rz={rz} persp={persp} scale={scale} w={w} tread={tread} rise={rise}
        />
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 border-t border-black/10 bg-white/90 p-5 backdrop-blur">
        <p className="col-span-2 flex items-center justify-between font-mono text-xs text-ink/60">
          <span>ลาก = orbit · shift+ลาก = roll · scroll = zoom · {param}</span>
          <span className="flex items-center gap-2">
            <select
              onChange={(e) => applyMode(e.target.value)}
              defaultValue=""
              className="rounded border border-black/15 bg-white px-2 py-0.5 text-ink"
            >
              <option value="" disabled>mode…</option>
              {Object.keys(MODES).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <button onClick={() => navigator.clipboard?.writeText(param)} className="rounded bg-ink px-2 py-0.5 text-white">copy</button>
            <button onClick={exportSvg} className="rounded bg-[#4CA342] px-2 py-0.5 text-white">export SVG</button>
          </span>
        </p>
        <Row label="rotateX" v={rx} set={setRx} min={-180} max={180} />
        <Row label="rotateY" v={ry} set={setRy} min={-180} max={180} />
        <Row label="rotateZ" v={rz} set={setRz} min={-180} max={180} />
        <Row label="perspective" v={persp} set={setPersp} min={400} max={3000} />
        <Row label="scale×100" v={Math.round(scale * 100)} set={(n) => setScale(n / 100)} min={40} max={300} />
        <Row label="width" v={w} set={setW} min={80} max={400} />
        <Row label="tread" v={tread} set={setTread} min={10} max={120} />
        <Row label="rise" v={rise} set={setRise} min={10} max={100} />
        <Row label="steps" v={count} set={setCount} min={2} max={10} />
      </div>
    </div>
  );
}
