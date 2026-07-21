import { useState } from "react";
import TaxStoryChapter, { type TaxStoryData } from "./TaxStoryChapter";

// ?tax — standalone preview of the tax story chapter with mock numbers, for
// screenshot iteration without needing a Supabase session.
const MOCK: TaxStoryData = {
  rate: 5,
  year: "2569",
  collectedRefund: 4280,
  fullRefund: 9600,
  confirmed: 7,
  total: 15,
};

export default function TaxStoryPOC() {
  const [run, setRun] = useState(0); // remount key to replay
  return (
    <div key={run} className="relative h-dvh bg-gradient-to-b from-[#CFE0F2] to-[#F6F4F1] font-kanit">
      <TaxStoryChapter data={MOCK} active />
      <button
        onClick={() => setRun((n) => n + 1)}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-ink px-6 py-2 text-sm font-medium text-white"
      >
        เล่นใหม่
      </button>
    </div>
  );
}
