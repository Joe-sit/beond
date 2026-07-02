import { useState } from "react";
import { userProfile } from "../data/mockData";

type Lang = "TH" | "EN";

function LangToggle() {
  const [lang, setLang] = useState<Lang>("TH");
  const langs: Lang[] = ["TH", "EN"];
  return (
    <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1 text-xs font-semibold">
      {langs.map((code) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          className={`rounded-full px-3 py-1.5 transition-colors ${
            lang === code ? "bg-[#1e3a5f] text-white shadow-sm" : "text-gray-400"
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  );
}

export default function ProfileHeader() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-sky-200 to-indigo-300 text-lg font-bold text-white">
          {userProfile.handle.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-base font-bold text-gray-900">{userProfile.handle}</p>
          <p className="text-xs text-gray-400">{userProfile.loginVia}</p>
        </div>
      </div>
      <LangToggle />
    </div>
  );
}
