import { useState } from "react";
import { Home, Wallet, Ticket, CalendarDays } from "lucide-react";
import logo from "../assets/beond-icon.svg";

const NAV_ITEMS = [
  { key: "home", th: "หน้าหลัก", en: "Home", icon: Home, iconColor: "text-white" },
  { key: "wallet", th: "กระเป๋าเงิน", en: "Wallet", icon: Wallet, iconColor: "text-emerald-600" },
  { key: "coupon", th: "คูปอง", en: "Coupon", icon: Ticket, iconColor: "text-gray-400" },
  { key: "calendar", th: "ปฏิทิน", en: "Calendar", icon: CalendarDays, iconColor: "text-gray-400" },
];

export default function TopNav() {
  const [active, setActive] = useState("home");
  const [lang, setLang] = useState("TH");

  return (
    <header className="flex items-center justify-between px-6 py-6 md:px-10">
      <div className="flex items-center">
        <img src={logo} alt="beond" width={171} height={54} />
      </div>

      <nav className="flex items-center gap-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setActive(item.key)}
              aria-label={lang === "TH" ? item.th : item.en}
              className={`flex items-center gap-2 rounded-2xl px-3.5 py-2.5 transition-colors ${
                isActive ? "bg-[#1e3a5f]" : "bg-white/80 shadow-sm"
              }`}
            >
              <Icon size={18} className={isActive ? "text-white" : item.iconColor} />
              {isActive && (
                <span className="text-sm font-medium text-white">
                  {lang === "TH" ? item.th : item.en}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <button
        onClick={() => setLang((l) => (l === "TH" ? "EN" : "TH"))}
        className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-500 shadow-sm"
        aria-label="Toggle language"
      >
        <span className={lang === "TH" ? "text-gray-900" : ""}>TH</span>
        <span className={lang === "EN" ? "text-gray-900" : ""}>EN</span>
      </button>
    </header>
  );
}
