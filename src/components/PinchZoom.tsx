import {
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as RPointerEvent,
  type WheelEvent as RWheelEvent,
} from "react";

interface PinchZoomProps {
  children: ReactNode;
  min?: number;
  max?: number;
  className?: string;
}

interface Transform {
  scale: number;
  x: number;
  y: number;
}

const IDENTITY: Transform = { scale: 1, x: 0, y: 0 };

// Pinch / wheel / drag zoom for any child (used for the 3D allocation chart).
// Zooming scales the content, so SVG text grows and reads clearly when zoomed.
export default function PinchZoom({ children, min = 1, max = 4, className }: PinchZoomProps) {
  const [t, setT] = useState<Transform>(IDENTITY);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  // Baselines captured at gesture start, so moves map absolutely (no drift).
  const pinch = useRef<{ dist: number; cx: number; cy: number; base: Transform } | null>(null);
  const pan = useRef<{ px: number; py: number; base: Transform } | null>(null);

  const clamp = (s: number) => Math.min(max, Math.max(min, s));

  const local = (clientX: number, clientY: number) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  };

  // Scale toward (cx, cy) keeping that point fixed on screen.
  const applyZoom = (base: Transform, scale: number, cx: number, cy: number): Transform => {
    const k = scale / base.scale;
    return { scale, x: cx - (cx - base.x) * k, y: cy - (cy - base.y) * k };
  };

  const onWheel = (e: RWheelEvent) => {
    e.preventDefault();
    const p = local(e.clientX, e.clientY);
    setT((prev) => applyZoom(prev, clamp(prev.scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12)), p.x, p.y));
  };

  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const onPointerDown = (e: RPointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e.clientX, e.clientY));
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      pan.current = null;
      pinch.current = {
        dist: dist(pts[0], pts[1]),
        cx: (pts[0].x + pts[1].x) / 2,
        cy: (pts[0].y + pts[1].y) / 2,
        base: t,
      };
    } else if (pts.length === 1 && t.scale > 1) {
      pan.current = { px: pts[0].x, py: pts[0].y, base: t };
    }
  };

  const onPointerMove = (e: RPointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e.clientX, e.clientY);
    pointers.current.set(e.pointerId, p);
    const pts = [...pointers.current.values()];

    if (pts.length >= 2 && pinch.current) {
      const d = dist(pts[0], pts[1]);
      const scale = clamp(pinch.current.base.scale * (d / pinch.current.dist));
      setT(applyZoom(pinch.current.base, scale, pinch.current.cx, pinch.current.cy));
    } else if (pts.length === 1 && pan.current) {
      const { px, py, base } = pan.current;
      setT({ scale: base.scale, x: base.x + (p.x - px), y: base.y + (p.y - py) });
    }
  };

  const endPointer = (e: RPointerEvent) => {
    pointers.current.delete(e.pointerId);
    const pts = [...pointers.current.entries()];
    if (pts.length < 2) pinch.current = null;
    // Dropping from two fingers to one: re-baseline the pan so it doesn't jump.
    if (pts.length === 1 && t.scale > 1) {
      pan.current = { px: pts[0][1].x, py: pts[0][1].y, base: t };
    } else if (pts.length === 0) {
      pan.current = null;
    }
  };

  const reset = () => setT(IDENTITY);

  return (
    <div
      ref={wrapRef}
      className={`relative touch-none ${className ?? ""}`}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onDoubleClick={reset}
    >
      <div
        className="h-full w-full origin-top-left"
        style={{
          transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})`,
          transition: pointers.current.size ? "none" : "transform 120ms ease-out",
        }}
      >
        {children}
      </div>
      {t.scale > 1.01 && (
        <button
          onClick={reset}
          className="absolute right-1 bottom-1 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/60"
        >
          รีเซ็ต
        </button>
      )}
    </div>
  );
}
