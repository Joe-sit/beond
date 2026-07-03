import { useState } from "react";
import { LogOut } from "lucide-react";
import { userProfile } from "../data/mockData";
import avatar from "../assets/avatar.png";
import type { AuthProfile } from "../lib/auth";

type Lang = "TH" | "EN";

function LangToggle() {
  const [lang, setLang] = useState<Lang>("TH");
  const langs: Lang[] = ["TH", "EN"];
  return (
    <div className="flex items-center gap-2.5">
      {langs.map((code) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          className={`rounded-lg px-3 py-1 text-sm transition-colors ${
            lang === code
              ? "bg-[#43507F]/10 font-bold text-[#43507F]"
              : "font-medium text-black/60"
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  );
}

interface ProfileHeaderProps {
  profile: AuthProfile;
  onLogout: () => void;
}

export default function ProfileHeader({ profile, onLogout }: ProfileHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-end gap-3 rounded-2xl bg-white px-4 py-2">
        <img
          src={profile.pictureUrl ?? avatar}
          alt={profile.displayName}
          className="h-12 w-12 rounded-full bg-[#D9D9D9] object-cover"
        />
        <div className="flex flex-col gap-1">
          <p className="text-base leading-tight font-bold text-[#43507F]">
            {profile.displayName}
          </p>
          <p className="text-xs leading-tight font-medium text-black/60">
            {userProfile.loginVia}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <LangToggle />
        <button
          onClick={onLogout}
          title="ออกจากระบบ"
          aria-label="ออกจากระบบ"
          className="rounded-lg p-2 text-black/40 transition-colors hover:bg-red-50 hover:text-red-500"
        >
          <LogOut size={18} />
        </button>
      </div>
    </div>
  );
}
