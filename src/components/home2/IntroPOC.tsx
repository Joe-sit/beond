import { useState } from "react";
import TaxStoryChapter, { type TaxStoryData } from "./TaxStoryChapter";

// ?intro — standalone harness for the goal-chapter opener (staircase + slip +
// text), rendered inside a panel that matches the real right column so the
// composition is debugged in context. No Supabase needed.
const MOCK: TaxStoryData = {
  rate: 5,
  year: "2569",
  collectedRefund: 10345,
  fullRefund: 23456,
  confirmed: 7,
  total: 15,
};

export default function IntroPOC() {
  const [run, setRun] = useState(0); // remount to replay
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#EEF1F5] p-6 font-kanit">
      <div className="relative flex h-[900px] w-[680px] flex-col overflow-hidden rounded-3xl bg-gradient-to-b from-[#779BC6] to-white p-6">
        <div key={run} className="absolute inset-0">
          <TaxStoryChapter data={MOCK} active />
        </div>
      </div>
      <button
        onClick={() => setRun((n) => n + 1)}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-ink px-6 py-2 text-sm font-medium text-white"
      >
        เล่นใหม่
      </button>
    </div>
  );
}
