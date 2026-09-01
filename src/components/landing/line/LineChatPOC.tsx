/** DEV-only (`?line`): the LINE chat screen at phone size, so its cards can be
 *  tuned without scrolling the landing page into the 3D device. */
import { useMotionValue } from "motion/react";
import LineChat, { SCREEN_H, SCREEN_W } from "./LineChat";

export default function LineChatPOC() {
  const p = useMotionValue(0);
  return (
    <div className="flex min-h-svh items-center justify-center gap-8 bg-[#E9EDF3] p-8">
      <div
        className="overflow-hidden rounded-[38px] shadow-2xl"
        style={{ width: SCREEN_W, height: SCREEN_H }}
      >
        <LineChat progress={p} />
      </div>
      <label className="flex h-[600px] flex-col items-center gap-3 text-sm">
        เลื่อนแชท
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          defaultValue={0}
          onChange={(e) => p.set(Number(e.target.value))}
          className="h-full [writing-mode:vertical-lr]"
        />
      </label>
    </div>
  );
}
