import { useState } from "react";
import AllocationStaircase from "./AllocationStaircase";
import PinchZoom from "./PinchZoom";
import TicketPlusIcon from "./icons/TicketPlusIcon";
import AddBondModal from "./AddBondModal";
import { allocationUpdatedAt } from "../data/mockData";
import { useAllocation } from "../hooks/usePortfolio";
import { SECTOR_ICON, SECTOR_ICON_FALLBACK } from "../data/sectorIcons";

function formatTHB(value: number): string {
  return new Intl.NumberFormat("th-TH").format(value);
}

export default function AllocationCard() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const { holdings: allocationHoldings, refetch } = useAllocation();

  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#E7E7E7] bg-white p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-bold text-[#43507F]">สัดส่วนการลงทุน</h2>
          <p className="text-xs font-medium text-black/60">
            ข้อมูลนี้มาจากการเพิ่มหุ้นกู้ในพอร์ตของคุณ
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex shrink-0 items-center gap-2 rounded-[14px] bg-[#43507F] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#525f92]"
        >
          <TicketPlusIcon size={20} />
          เพิ่มหุ้นกู้
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-[0.8fr_1.2fr]">
        <ul className="flex flex-col gap-2 pb-8">
          {allocationHoldings.map((h) => {
            const dimmed = activeId !== null && activeId !== h.id;
            const Icon = SECTOR_ICON[h.id] ?? SECTOR_ICON_FALLBACK;
            return (
              <li
                key={h.id}
                onMouseEnter={() => setActiveId(h.id)}
                onMouseLeave={() => setActiveId(null)}
                className="flex cursor-pointer items-center gap-2 rounded-lg"
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors duration-300 ease-out"
                  style={{
                    backgroundColor: dimmed ? `${h.color}0D` : `${h.color}1A`,
                    color: dimmed ? `${h.color}59` : h.color,
                  }}
                >
                  <Icon size={15} stroke={2} />
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <p
                    className={`truncate text-xs leading-tight font-bold transition-colors duration-300 ease-out ${
                      dimmed ? "text-black/20" : "text-black/60"
                    }`}
                  >
                    {h.label} (<span className="font-nunito">{h.pct}%</span>)
                  </p>
                  <p
                    className={`text-xs leading-tight transition-colors duration-300 ease-out ${
                      dimmed ? "text-black/20" : "text-black/60"
                    }`}
                  >
                    มูลค่า <span className="font-nunito">฿{formatTHB(h.value)}</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex items-end justify-end">
          <PinchZoom className="-mr-6 -mb-7 h-80 w-full" max={5}>
            <AllocationStaircase
              holdings={allocationHoldings}
              activeId={activeId}
              onHover={setActiveId}
            />
          </PinchZoom>
        </div>
      </div>

      {/* Fade footer over the legend, matching Figma Frame 123 */}
      <div className="pointer-events-none absolute bottom-0 left-0 flex w-81 items-center bg-linear-to-b from-white/0 to-white to-45% p-6 backdrop-blur-[2px]">
        <p className="text-xs font-medium text-black/40">
          ข้อมูลล่าสุด {allocationUpdatedAt}
        </p>
      </div>

      <AddBondModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={refetch}
      />
    </div>
  );
}
