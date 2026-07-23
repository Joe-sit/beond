import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { SlipCollectOverlay } from "./HomeDashboard";
import type { SlipPaperData } from "./BondScanStack";

// `?collect` — debug the "slip collected into folder" LINE-confirm notification.
// Edit the mock fields + replay the overlay in isolation.
const MOCK: SlipPaperData = {
  id: "dbg",
  symbol: "BAM284A",
  issuer: "บริหารสินทรัพย์",
  installment: "1/2",
  wht: 2640,
  net: 14960,
};

export default function SlipCollectPOC() {
  const [slip, setSlip] = useState<SlipPaperData>(MOCK);
  const [playing, setPlaying] = useState(false);

  const set = (k: keyof SlipPaperData, v: string) =>
    setSlip((s) => ({ ...s, [k]: k === "wht" || k === "net" ? Number(v) || 0 : v }));

  const field = (k: keyof SlipPaperData, label: string) => (
    <label className="flex flex-col gap-1 text-sm font-medium text-black/60">
      {label}
      <input
        value={String(slip[k] ?? "")}
        onChange={(e) => set(k, e.target.value)}
        className="rounded-xl border border-[#E7E7E7] bg-white px-3 py-2 text-base font-normal text-[#181D20] outline-none focus:border-[#43507F]"
      />
    </label>
  );

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#779BC6] to-white p-8">
      <div className="mx-auto max-w-md rounded-3xl bg-white/85 p-6 backdrop-blur">
        <h1 className="text-2xl font-medium text-[#181D20]">Debug · แจ้งเตือนเก็บสลิป</h1>
        <p className="mt-1 text-sm text-black/60">
          จำลองการแจ้งเตือนตอน user ยืนยันสลิปผ่าน LINE (slip ปลิวเข้าแฟ้ม + ปุ่มรับทราบ).
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {field("symbol", "ชื่อรุ่น")}
          {field("issuer", "บริษัท")}
          {field("installment", "งวดที่")}
          {field("net", "ยอดสุทธิ (บาท)")}
          {field("wht", "หัก ณ ที่จ่าย (บาท)")}
        </div>

        <button
          onClick={() => setPlaying(true)}
          className="mt-6 w-full rounded-2xl bg-[#43507F] px-4 py-3 text-base font-medium text-white transition hover:bg-[#3a466e]"
        >
          ▶ เล่นการแจ้งเตือน
        </button>
      </div>

      <AnimatePresence>
        {playing && <SlipCollectOverlay slip={slip} onDone={() => setPlaying(false)} />}
      </AnimatePresence>
    </div>
  );
}
