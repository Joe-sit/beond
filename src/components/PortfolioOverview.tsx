import ProfileHeader from "./ProfileHeader";
import AllocationCard from "./AllocationCard";
import BottomCards from "./BottomCards";

export default function PortfolioOverview() {
  return (
    <div className="space-y-6">
      <ProfileHeader />
      <AllocationCard />
      <BottomCards />
    </div>
  );
}
