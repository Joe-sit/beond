import { type ReactNode } from "react";
import HeroBackground from "./HeroBackground";

interface DashboardLayoutProps {
  hero: ReactNode;
  panel: ReactNode;
}

export default function DashboardLayout({ hero, panel }: DashboardLayoutProps) {
  return (
    <div className="relative h-screen overflow-hidden bg-[#F6F4F1]">
      {/* Full-width hero illustration (gradient + clouds + rising bond + podium). */}
      <HeroBackground className="pointer-events-none absolute inset-x-0 top-0 h-[22vw] w-full" />

      {/* Left column is fixed (no scroll); the right panel manages its own. */}
      <div className="relative grid h-full grid-cols-1 lg:grid-cols-2">
        <div className="h-full overflow-hidden">{hero}</div>
        <div className="flex h-full min-h-0 flex-col p-5 md:p-6">{panel}</div>
      </div>
    </div>
  );
}
