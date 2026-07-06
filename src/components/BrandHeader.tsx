import { useEffect, useRef, useState } from "react";
import { IconLogout } from "@tabler/icons-react";
import logo from "../assets/beond-icon.svg";
import avatarFallback from "../assets/avatar.png";
import { userProfile } from "../data/mockData";
import type { AuthProfile } from "../lib/auth";

interface BrandHeaderProps {
  profile: AuthProfile;
  onLogout: () => void;
}

export default function BrandHeader({ profile, onLogout }: BrandHeaderProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close the menu on any outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="flex items-center justify-between px-8 pt-8 md:px-12">
      <img src={logo} alt="beond — Bring Your Bonds Beyond" width={150} height={47} />

      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="เมนูบัญชี"
          className="block rounded-full ring-4 ring-white/70 transition hover:ring-white"
        >
          <img
            src={profile.pictureUrl ?? avatarFallback}
            alt={profile.displayName}
            className="h-12 w-12 rounded-full bg-[#D9D9D9] object-cover"
          />
        </button>

        {open && (
          <div className="absolute right-0 z-40 mt-2 w-52 overflow-hidden rounded-2xl border border-[#E7E7E7] bg-white shadow-lg">
            <div className="border-b border-[#E7E7E7] px-4 py-3">
              <p className="truncate text-sm font-bold text-[#43507F]">{profile.displayName}</p>
              <p className="text-xs text-black/50">{userProfile.loginVia}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-red-500 transition hover:bg-red-50"
            >
              <IconLogout size={18} />
              ออกจากระบบ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
