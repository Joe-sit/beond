import { Plus } from "lucide-react";
import AllocationStaircase from "./AllocationStaircase";
import { allocationHoldings, allocationUpdatedAt } from "../data/mockData";

function formatTHB(value: number): string {
  return new Intl.NumberFormat("th-TH").format(value);
}

export default function AllocationCard() {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">สัดส่วนการลงทุน</h2>
          <p className="mt-1 text-xs text-gray-400">
            ข้อมูลนี้มาจากการเพิ่มหุ้นกู้ในพอร์ตของคุณ
          </p>
        </div>
        <button className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#274670]">
          <Plus size={16} />
          เพิ่มหุ้นกู้
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ul className="space-y-3">
          {allocationHoldings.map((h) => (
            <li key={h.id} className="flex items-start gap-2.5">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-slate-300" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-800">
                  {h.label} (<span className="font-nunito">{h.pct}%</span>)
                </p>
                <p className="text-xs text-gray-400">
                  มูลค่า <span className="font-nunito">฿{formatTHB(h.value)}</span>
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex items-end justify-center">
          <div className="h-48 w-full max-w-55">
            <AllocationStaircase />
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-gray-400">ข้อมูลล่าสุด {allocationUpdatedAt}</p>
    </div>
  );
}
