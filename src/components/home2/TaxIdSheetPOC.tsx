import { useState } from "react";
import TaxIdErrorSheet from "../TaxIdErrorSheet";

/**
 * `?sheet` — debug the payer-tax-id mismatch bottom sheet (Figma 1287:4348)
 * without running a scan. It renders the SAME component the scan flow uses, so
 * anything tuned here lands in the real screen.
 *
 * The three cases below are the only reasons the sheet ever appears (see
 * ScanFlow's `guardedSubmit`): an incomplete id, a 13-digit id the DBD doesn't
 * know, and a valid id registered to a different company.
 */
const CASES = [
  { key: "short", label: "เลขไม่ครบ 13 หลัก", value: "0107536", digits: "0107536", liveName: undefined },
  { key: "notfound", label: "ไม่พบหมายเลข", value: "0999999999999", digits: "0999999999999", liveName: null },
  {
    key: "mismatch",
    label: "จดทะเบียนชื่ออื่น",
    value: "0107536000323",
    digits: "0107536000323",
    liveName: "บริษัท ปตท. จำกัด (มหาชน)",
  },
] as const;

/** Sheet width matches the phone frame; the real sheet is always full-width. */
const FRAMES = [
  { label: "iPhone SE", w: 375 },
  { label: "iPhone 14", w: 390 },
  { label: "iPhone 14 Pro Max", w: 430 },
] as const;

export default function TaxIdSheetPOC() {
  const [caseIdx, setCaseIdx] = useState(2);
  const [frameIdx, setFrameIdx] = useState(1);
  const c = CASES[caseIdx];
  const frame = FRAMES[frameIdx];

  return (
    <div className="flex min-h-dvh flex-col items-center gap-6 bg-[#F0F2F7] p-6">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {CASES.map((x, i) => (
          <button
            key={x.key}
            onClick={() => setCaseIdx(i)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition hover:bg-black/5 ${
              i === caseIdx ? "bg-[#43507F] text-white hover:bg-[#43507F]" : "bg-white text-[#1B1C1D]"
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {FRAMES.map((f, i) => (
          <button
            key={f.label}
            onClick={() => setFrameIdx(i)}
            className={`rounded-full px-4 py-1.5 text-xs transition hover:bg-black/5 ${
              i === frameIdx ? "bg-[#43507F] text-white hover:bg-[#43507F]" : "bg-white text-black/60"
            }`}
          >
            {f.label} · {f.w}px
          </button>
        ))}
      </div>

      {/* The sheet is `fixed`, so it needs its own containing block to stay
          inside the phone frame: `transform` on the wrapper creates one. */}
      <div
        className="relative overflow-hidden rounded-[2rem] border-8 border-black bg-white"
        style={{ width: frame.w, height: 720, transform: "translateZ(0)" }}
      >
        <TaxIdErrorSheet
          readValue={c.value}
          digits={c.digits}
          liveName={c.liveName}
          onClose={() => {}}
        />
      </div>

      <p className="text-center text-xs text-black/50">
        แก้ไฟล์ src/components/TaxIdErrorSheet.tsx — ScanFlow ใช้ตัวเดียวกัน
      </p>
    </div>
  );
}
