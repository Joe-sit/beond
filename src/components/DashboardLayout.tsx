import { useRef, type ReactNode, type UIEvent } from "react";
import HeroBackground from "./HeroBackground";

interface DashboardLayoutProps {
  hero: ReactNode;
  panel: ReactNode;
}

// The hero illustration is fully faded once the left column has scrolled
// this far — the timeline then floats on the plain surface.
const HERO_FADE_DISTANCE = 320;
// How far the cloud layer trails the scroll (fraction of scrollTop), giving the
// parallax: staircase stays put while the clouds drift downward.
const CLOUD_PARALLAX = 0.45;

export default function DashboardLayout({ hero, panel }: DashboardLayoutProps) {
  const heroRef = useRef<SVGSVGElement>(null);

  const handleHeroScroll = (e: UIEvent<HTMLDivElement>) => {
    const y = e.currentTarget.scrollTop;
    if (heroRef.current) {
      heroRef.current.style.opacity = String(
        Math.max(0, 1 - y / HERO_FADE_DISTANCE),
      );
      heroRef.current.style.setProperty("--cloud-shift", `${y * CLOUD_PARALLAX}px`);
    }
  };

  return (
    <div className="relative h-screen overflow-hidden bg-[#F6F4F1]">
      {/* Full-width hero illustration (gradient + clouds + rising bond + podium).
          Clouds parallax down on scroll while the staircase stays fixed. */}
      <HeroBackground
        svgRef={heroRef}
        className="pointer-events-none absolute inset-x-0 top-0 h-[22vw] w-full transition-opacity duration-150 ease-linear"
      />

      {/* Content sits above the hero; each column scrolls on its own */}
      <div className="relative grid h-full grid-cols-1 lg:grid-cols-2">
        <div className="no-scrollbar h-full overflow-y-auto" onScroll={handleHeroScroll}>
          {hero}
        </div>
        <div className="flex h-full min-h-0 flex-col p-5 md:p-6">{panel}</div>
      </div>
    </div>
  );
}
