import { Button } from "@heroui/react";
import { IconLogout, IconUserCircle, IconInfoCircle } from "@tabler/icons-react";
import { userProfile } from "../data/mockData";
import avatar from "../assets/avatar.png";
import type { AuthProfile } from "../lib/auth";

interface SettingsPanelProps {
  profile: AuthProfile;
  onLogout: () => void;
}

// "ตั้งค่า" tab — account info + logout. Room to grow (language, notifications…).
export default function SettingsPanel({ profile, onLogout }: SettingsPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-bold text-[#43507F]">ตั้งค่า</h2>

      <div className="flex items-center gap-3 rounded-3xl border border-[#E7E7E7] bg-[#F6F4F1] p-4">
        <img
          src={profile.pictureUrl ?? avatar}
          alt={profile.displayName}
          className="h-14 w-14 rounded-full bg-[#D9D9D9] object-cover"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[#43507F]">{profile.displayName}</p>
          <p className="text-xs font-medium text-black/50">{userProfile.loginVia}</p>
        </div>
      </div>

      <div className="flex flex-col divide-y divide-[#E7E7E7] overflow-hidden rounded-3xl border border-[#E7E7E7] bg-white">
        <div className="flex items-center gap-3 p-4 text-sm text-black/60">
          <IconUserCircle size={20} className="text-[#43507F]" />
          บัญชีเชื่อมกับ LINE
        </div>
        <div className="flex items-center gap-3 p-4 text-sm text-black/60">
          <IconInfoCircle size={20} className="text-[#43507F]" />
          beond · Bring Your Bonds Beyond
        </div>
      </div>

      <Button variant="danger-soft" fullWidth onPress={onLogout}>
        <IconLogout size={18} />
        ออกจากระบบ
      </Button>
    </div>
  );
}
