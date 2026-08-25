import { lazy, Suspense, useState } from "react";
import { useMotionValue } from "motion/react";
import type { PoseOverride } from "./HeroScreen3D";

// Lazy, like the landing page loads it — a static import here would pull three
// back into the main bundle and undo that split.
const HeroScreen3D = lazy(() => import("./HeroScreen3D"));

const START: PoseOverride = { pitch: -0.175, yaw: -0.52, roll: 0, scale: 0.74, lift: 0, collect: 0 };

const CONTROLS: { key: keyof PoseOverride; label: string; min: number; max: number; step: number }[] = [
  { key: "pitch", label: "pitch (rotateX)", min: -1.2, max: 1.2, step: 0.005 },
  { key: "yaw", label: "yaw (rotateY)", min: -1.2, max: 1.2, step: 0.005 },
  { key: "roll", label: "roll (rotateZ)", min: -0.6, max: 0.6, step: 0.005 },
  { key: "scale", label: "scale", min: 0.5, max: 1.6, step: 0.01 },
  { key: "lift", label: "lift (y)", min: -2, max: 2, step: 0.01 },
  { key: "collect", label: "slips collected", min: 0, max: 1, step: 0.01 },
];

/**
 * `?hero3d` — pose the hero's 3D window by hand. The sliders feed the same
 * override the scroll would otherwise drive, so whatever looks right here can
 * be copied straight into START / REST in HeroScreen3D.
 */
export default function HeroScreen3DPOC() {
  const [pose, setPose] = useState<PoseOverride>(START);
  // The component wants a MotionValue; the override wins, so its value is moot.
  const progress = useMotionValue(0);

  const set = (key: keyof PoseOverride, value: number) => setPose((p) => ({ ...p, [key]: value }));
  const deg = (rad: number) => `${((rad * 180) / Math.PI).toFixed(1)}°`;

  return (
    <div className="relative min-h-dvh bg-[linear-gradient(180deg,#779BC6_0%,#9CB6D6_55%,#F0F2F5_100%)] font-kanit">
      <div className="absolute inset-0">
        <Suspense fallback={null}>
          <HeroScreen3D progress={progress} reduce override={pose} />
        </Suspense>
      </div>

      <aside className="absolute top-6 left-6 w-[300px] rounded-2xl bg-white/90 p-5 backdrop-blur">
        <p className="text-sm font-medium text-[#1B1C1D]">hero 3D pose</p>
        <div className="mt-4 flex flex-col gap-4">
          {CONTROLS.map(({ key, label, min, max, step }) => (
            <label key={key} className="flex flex-col gap-1">
              <span className="flex items-center justify-between text-xs text-black/55">
                {label}
                <span className="font-nunito text-black/80">
                  {pose[key].toFixed(3)}
                  {key === "pitch" || key === "yaw" || key === "roll" ? ` · ${deg(pose[key])}` : ""}
                </span>
              </span>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={pose[key]}
                onChange={(e) => set(key, Number(e.target.value))}
                className="accent-[#43507F]"
              />
            </label>
          ))}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={() => setPose(START)}
            className="flex-1 rounded-xl bg-black/5 px-3 py-2 text-sm text-[#1B1C1D] transition hover:bg-black/10"
          >
            รีเซ็ต
          </button>
          <button
            onClick={() => navigator.clipboard?.writeText(JSON.stringify(pose, null, 2))}
            className="flex-1 rounded-xl bg-[#43507F] px-3 py-2 text-sm text-white transition hover:bg-[#525F92]"
          >
            คัดลอกค่า
          </button>
        </div>

        <pre className="mt-3 overflow-x-auto rounded-xl bg-black/5 p-3 font-nunito text-[11px] text-black/70">
{JSON.stringify(pose)}
        </pre>
      </aside>
    </div>
  );
}
