import { IconSmartHome, IconPencilDollar, IconSettings } from "@tabler/icons-react";
import logo from "../../assets/beond-mark.svg";

export type View = "home" | "tax" | "settings";

const NAV: { key: View; icon: typeof IconSmartHome; label: string }[] = [
  { key: "home", icon: IconSmartHome, label: "หน้าหลัก" },
  { key: "tax", icon: IconPencilDollar, label: "จัดการภาษี" },
  { key: "settings", icon: IconSettings, label: "ตั้งค่า" },
];

// Left icon rail (desktop) / bottom bar (mobile) — primary navigation.
export default function SidebarRail({ view, onSelect }: { view: View; onSelect: (v: View) => void }) {
  return (
    <nav
      className="fixed right-0 bottom-0 left-0 z-40 flex items-center justify-around border-t border-line bg-white/90 px-2 py-2 backdrop-blur
                 lg:top-0 lg:bottom-0 lg:left-0 lg:h-auto lg:w-[64px] lg:flex-col lg:justify-start lg:gap-2 lg:border-0 lg:border-r lg:border-line lg:px-0 lg:py-5"
    >
      <img src={logo} alt="beond" className="hidden size-9 rounded-xl object-contain lg:mb-3 lg:block" />
      {NAV.map((n) => {
        const active = view === n.key;
        return (
          <button
            key={n.key}
            onClick={() => onSelect(n.key)}
            aria-label={n.label}
            aria-current={active}
            className={`flex size-11 items-center justify-center rounded-2xl transition-colors ${
              active ? "bg-[#2968A5] text-white" : "text-[#2968A5]/45 hover:bg-[#2968A5]/10"
            }`}
          >
            <n.icon size={22} />
          </button>
        );
      })}
    </nav>
  );
}
