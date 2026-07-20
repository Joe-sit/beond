import { type ReactNode } from "react";
import HeroBackground from "./HeroBackground";

interface DashboardLayoutProps {
  hero: ReactNode;
  panel: ReactNode;
}

export default function DashboardLayout({ hero, panel }: DashboardLayoutProps) {
  return (
    // < lg (mobile/tablet): sections stack and the page scrolls naturally.
    // ≥ lg (desktop): fixed two-column viewport, panels scroll internally.
    <div className="relative min-h-dvh bg-[#F6F4F1] lg:h-screen lg:overflow-hidden">
      {/* Full-width hero illustration (gradient + clouds + rising bond + podium).
          Taller on small screens so the band still reads behind the header. */}
      <HeroBackground className="pointer-events-none absolute inset-x-0 top-0 h-[88vw] w-full sm:h-[52vw] lg:h-[22vw]" />

      <div className="relative grid grid-cols-1 lg:h-full lg:grid-cols-2">
        <div className="lg:h-full lg:overflow-hidden">{hero}</div>
        <div className="flex min-h-0 flex-col p-4 sm:p-5 md:p-6 lg:h-full">{panel}</div>
      </div>
    </div>
  );
}
