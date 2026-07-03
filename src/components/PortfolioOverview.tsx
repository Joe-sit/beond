import ProfileHeader from "./ProfileHeader";
import AllocationCard from "./AllocationCard";
import BottomCards from "./BottomCards";
import type { AuthProfile } from "../lib/auth";

interface PortfolioOverviewProps {
  profile: AuthProfile;
  onLogout: () => void;
}

export default function PortfolioOverview({ profile, onLogout }: PortfolioOverviewProps) {
  return (
    <div className="space-y-6">
      <ProfileHeader profile={profile} onLogout={onLogout} />
      <AllocationCard />
      <BottomCards />
    </div>
  );
}
