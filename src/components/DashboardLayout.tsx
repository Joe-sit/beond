import { useRef, type ReactNode, type UIEvent } from "react";
import beondHero from "../assets/beond-hero.svg";

interface DashboardLayoutProps {
  hero: ReactNode;
  panel: ReactNode;
}

// The hero illustration is fully faded once the left column has scrolled
// this far — the timeline then floats on the plain surface.
const HERO_FADE_DISTANCE = 320;

export default function DashboardLayout({ hero, panel }: DashboardLayoutProps) {
  const heroRef = useRef<HTMLImageElement>(null);

  const handleHeroScroll = (e: UIEvent<HTMLDivElement>) => {
    const y = e.currentTarget.scrollTop;
    if (heroRef.current) {
      heroRef.current.style.opacity = String(
        Math.max(0, 1 - y / HERO_FADE_DISTANCE),
      );
    }
  };

  return (
    <div className="relative h-screen overflow-hidden bg-[#F6F4F1]">
      {/* Full-width hero illustration (gradient + clouds + rising bond + podium) */}
      <img
        ref={heroRef}
        src={beondHero}
        alt=""
        className="pointer-events-none absolute inset-x-0 top-0 h-[22vw] w-full object-cover object-bottom transition-opacity duration-150 ease-linear"
      />

      {/* Content sits above the hero; each column scrolls on its own */}
      <div className="relative grid h-full grid-cols-1 lg:grid-cols-2">
        <div className="no-scrollbar h-full overflow-y-auto" onScroll={handleHeroScroll}>
          {hero}
        </div>
        <div className="flex h-full min-h-0 p-5 md:p-6">
          <div className="flex-1 overflow-hidden rounded-4xl bg-white shadow-xl">
            <div className="no-scrollbar h-full overflow-y-auto p-6 md:p-8">{panel}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
