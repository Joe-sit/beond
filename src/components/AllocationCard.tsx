import { useState } from "react";
import { Button, Tooltip } from "@heroui/react";
import { IconFlask2, IconListDetails } from "@tabler/icons-react";
import AllocationStaircase from "./AllocationStaircase";
import ManageBondsModal from "./ManageBondsModal";
import { allocationUpdatedAt } from "../data/mockData";
import { useAllocation } from "../hooks/usePortfolio";
import { SECTOR_ICON, SECTOR_ICON_FALLBACK } from "../data/sectorIcons";
import { supabaseEnabled } from "../lib/supabase";
import { resetAndSeedTestData } from "../lib/testData";

function formatTHB(value: number): string {
  return new Intl.NumberFormat("th-TH").format(value);
}

type ViewMode = "sector" | "rating" | "bond";

const VIEW_TABS: [ViewMode, string][] = [
  ["rating", "ตามอันดับเสี่ยง"],
  ["sector", "ตามกลุ่มธุรกิจ"],
  ["bond", "ตามรุ่น"],
];

export default function AllocationCard() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [view, setView] = useState<ViewMode>("sector");
  const { holdings: allocationHoldings, refetch } = useAllocation(view);

  const loadTestData = async () => {
    if (seeding) return;
    setSeeding(true);
    try {
      await resetAndSeedTestData();
      window.location.reload();
    } catch (e) {
      setSeeding(false);
      alert(`โหลด test data ไม่สำเร็จ: ${e instanceof Error ? e.message : e}`);
    }
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-[#E7E7E7] bg-[#F6F4F1] p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-[#43507F]">สัดส่วนการลงทุน</h2>
        <div className="flex shrink-0 items-center gap-2">
          {supabaseEnabled && (
            <>
              <Tooltip>
                <Button isIconOnly size="sm" variant="ghost" onPress={() => setManageOpen(true)} aria-label="จัดการหุ้นกู้">
                  <IconListDetails size={18} />
                </Button>
                <Tooltip.Content>จัดการหุ้นกู้ — แก้จำนวนเงิน / ลบ</Tooltip.Content>
              </Tooltip>
              <Tooltip>
                <Button isIconOnly size="sm" variant="ghost" isDisabled={seeding} onPress={loadTestData} aria-label="โหลดข้อมูลตัวอย่าง">
                  <IconFlask2 size={18} />
                </Button>
                <Tooltip.Content>ล้างพอร์ตแล้วโหลดข้อมูลหุ้นกู้ตัวอย่าง</Tooltip.Content>
              </Tooltip>
            </>
          )}
          {/* View mode: group the pillars by risk rating or business sector. */}
          <div className="flex items-center gap-1">
            {VIEW_TABS.map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => {
                  setActiveId(null);
                  setView(mode);
                }}
                className={`rounded-lg px-3 py-1 text-xs transition-colors ${
                  view === mode
                    ? "bg-[#43507F]/10 font-bold text-[#43507F]"
                    : "font-medium text-black/60 hover:text-black/80"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 grid min-h-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-[0.8fr_1.2fr]">
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

        <div className="flex min-h-0 items-end justify-end">
          {/* Cap the staircase to a viewport-relative height so the pillars scale
              with the screen instead of ballooning to fill the whole card. */}
          <div className="-mb-2 h-[clamp(160px,24vh,280px)] w-full">
            <AllocationStaircase
              holdings={allocationHoldings}
              activeId={activeId}
              onHover={setActiveId}
            />
          </div>
        </div>
      </div>

      {/* Fade footer over the legend, matching Figma Frame 123 */}
      <div className="pointer-events-none absolute bottom-0 left-0 flex w-81 items-center bg-linear-to-b from-[#f6f4f1]/0 to-[#f6f4f1] to-45% p-6 backdrop-blur-[2px]">
        <p className="text-xs font-medium text-black/40">
          ข้อมูลล่าสุด {allocationUpdatedAt}
        </p>
      </div>

      <ManageBondsModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        onChanged={refetch}
      />
    </div>
  );
}
