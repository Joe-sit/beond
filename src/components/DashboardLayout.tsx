import type { ReactNode } from "react";
import beondHero from "../assets/beond-hero.svg";

interface DashboardLayoutProps {
  hero: ReactNode;
  panel: ReactNode;
}

export default function DashboardLayout({ hero, panel }: DashboardLayoutProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F6F4F1]">
      {/* Full-width hero illustration (gradient + clouds + rising bond + podium) */}
      <img
        src={beondHero}
        alt=""
        className="pointer-events-none absolute inset-x-0 top-0 w-full"
      />

      {/* Content sits above the hero; right panel floats over it */}
      <div className="relative grid grid-cols-1 lg:grid-cols-2">
        <div>{hero}</div>
        <div className="flex p-5 md:p-6">
          <div className="flex-1 rounded-4xl bg-white p-6 shadow-xl md:p-8">{panel}</div>
        </div>
      </div>
    </div>
  );
}
