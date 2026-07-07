import { useState } from "react";
import { Button, Tooltip } from "@heroui/react";
import { IconListDetails } from "@tabler/icons-react";
import AllocationStaircase from "./AllocationStaircase";
import ManageBondsModal from "./ManageBondsModal";
import IssuerLogo from "./IssuerLogo";

function formatTHB(value: number): string {
  return new Intl.NumberFormat("th-TH").format(value);
}
import { useAllocation } from "../hooks/usePortfolio";
import { SECTOR_ICON, SECTOR_ICON_FALLBACK } from "../data/sectorIcons";
import { supabaseEnabled } from "../lib/supabase";


type ViewMode = "sector" | "rating" | "bond";

const VIEW_TABS: [ViewMode, string][] = [
  ["rating", "ตามอันดับเสี่ยง"],
  ["sector", "ตามกลุ่มธุรกิจ"],
  ["bond", "ตามรุ่น"],
];

export default function AllocationCard() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [view, setView] = useState<ViewMode>("bond");
  const { holdings: allocationHoldings, loading, refetch } = useAllocation(view);

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
        {loading ? (
          <>
            <ul className="flex flex-col gap-2 pb-8">
              {Array.from({ length: 4 }, (_, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="h-6 w-6 shrink-0 animate-pulse rounded-full bg-black/5" />
                  <div className="flex flex-1 flex-col gap-1">
                    <span className="h-3 w-20 animate-pulse rounded bg-black/5" />
                    <span className="h-3 w-14 animate-pulse rounded bg-black/5" />
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex items-end justify-end gap-2 pb-2">
              {[45, 72, 58, 88, 66].map((h, i) => (
                <div
                  key={i}
                  className="w-7 animate-pulse rounded-t-lg bg-black/5"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </>
        ) : (
        <>
        <ul className="no-scrollbar flex min-h-0 flex-col gap-2 overflow-y-auto pb-8">
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
                {h.symbol ? (
                  <IssuerLogo
                    symbol={h.symbol}
                    name={h.label}
                    size={24}
                    className={`transition-opacity duration-300 ease-out ${dimmed ? "opacity-40" : ""}`}
                  />
                ) : (
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors duration-300 ease-out"
                    style={{
                      backgroundColor: dimmed ? `${h.color}0D` : `${h.color}1A`,
                      color: dimmed ? `${h.color}59` : h.color,
                    }}
                  >
                    <Icon size={15} stroke={2} />
                  </span>
                )}
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

        <div className="flex min-h-0 items-stretch justify-end">
          {/* Fill the remaining card height — the staircase grows to whatever
              space is left below the header/legend. */}
          <div className="-mb-2 h-full min-h-40 w-full">
            <AllocationStaircase
              holdings={allocationHoldings}
              activeId={activeId}
              onHover={setActiveId}
            />
          </div>
        </div>
        </>
        )}
      </div>


      <ManageBondsModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        onChanged={refetch}
      />
    </div>
  );
}
