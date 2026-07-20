import { useState } from "react";
import { IconLayoutGrid, IconReceipt2, IconSettings } from "@tabler/icons-react";
import PortfolioOverview from "./PortfolioOverview";
import TaxManagePanel from "./TaxManagePanel";
import SettingsPanel from "./SettingsPanel";
import type { AuthProfile } from "../lib/auth";

type TabKey = "home" | "tax" | "settings";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "home", label: "หน้าหลัก", icon: <IconLayoutGrid size={18} /> },
  { key: "tax", label: "จัดการภาษี", icon: <IconReceipt2 size={18} /> },
  { key: "settings", label: "ตั้งค่า", icon: <IconSettings size={18} /> },
];

interface RightPanelProps {
  profile: AuthProfile;
  onLogout: () => void;
}

// Tabbed right column: the active tab merges into the white content card below
// (its top-left corner is square so the tab reads as attached).
export default function RightPanel({ profile, onLogout }: RightPanelProps) {
  const [tab, setTab] = useState<TabKey>("home");

  return (
    // < lg the panel grows with its content (page scrolls); ≥ lg it fills the
    // fixed column and scrolls internally.
    <div className="flex min-h-0 flex-col lg:h-full">
      <div className="flex gap-1.5">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-t-2xl px-3 py-3 text-xs font-bold transition-colors sm:px-6 lg:w-35 lg:flex-none ${
                active
                  ? "bg-white text-[#43507F]"
                  : "bg-white/40 text-[#43507F]/60 hover:bg-white/70"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 rounded-3xl rounded-tl-none bg-white lg:overflow-hidden">
        {tab === "home" ? (
          <div className="p-4 sm:p-6 md:p-8 lg:h-full lg:overflow-hidden">
            <PortfolioOverview />
          </div>
        ) : (
          <div className="no-scrollbar p-4 sm:p-6 md:p-8 lg:h-full lg:overflow-y-auto">
            {tab === "tax" && <TaxManagePanel />}
            {tab === "settings" && <SettingsPanel profile={profile} onLogout={onLogout} />}
          </div>
        )}
      </div>
    </div>
  );
}
