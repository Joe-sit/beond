import HeroBackground from "./HeroBackground";

// First-paint skeleton — mirrors the real DashboardLayout so the shell doesn't
// jump when auth resolves: fixed left hero column (brand → income → timeline)
// and the tabbed right column (tabs + white card holding summary/scan/allocation).
export default function DashboardSkeleton() {
  return (
    <div className="relative min-h-dvh bg-[#F6F4F1] lg:h-screen lg:overflow-hidden">
      <HeroBackground className="pointer-events-none absolute inset-x-0 top-0 h-[88vw] w-full sm:h-[52vw] lg:h-[22vw]" />

      <div className="relative grid grid-cols-1 lg:h-full lg:grid-cols-2">
        {/* Left hero column — brand row, centered income headline, timeline */}
        <div className="flex flex-col lg:h-full lg:overflow-hidden">
          <div className="flex items-center justify-between px-6 pt-6 sm:px-8 md:px-12">
            <div className="h-8 w-28 animate-pulse rounded-lg bg-white/30" />
            <div className="h-8 w-8 animate-pulse rounded-full bg-white/30" />
          </div>
          <div className="flex flex-col items-center px-8 pt-6">
            <div className="h-4 w-40 animate-pulse rounded bg-white/30" />
            <div className="mt-3 h-10 w-56 animate-pulse rounded-xl bg-white/40" />
          </div>
          <div className="mt-auto flex h-64 items-end gap-3 px-6 pt-24 pb-10 sm:px-8 md:px-12 lg:h-auto lg:pt-0">
            {[52, 78, 40, 88, 60, 72, 46].map((h, i) => (
              <div
                key={i}
                className="flex-1 animate-pulse rounded-t-lg bg-black/5"
                style={{ height: `${h}%`, maxHeight: 180 }}
              />
            ))}
          </div>
        </div>

        {/* Right tabbed column */}
        <div className="flex min-h-0 flex-col p-4 sm:p-5 md:p-6 lg:h-full">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`h-11 flex-1 rounded-t-2xl lg:w-35 lg:flex-none ${i === 0 ? "bg-white" : "animate-pulse bg-white/40"}`}
              />
            ))}
          </div>
          <div className="flex min-h-120 flex-1 flex-col gap-4 rounded-3xl rounded-tl-none bg-white p-4 sm:p-6 md:p-8 lg:min-h-0">
            {/* Portfolio summary card */}
            <div className="h-32 shrink-0 animate-pulse rounded-3xl bg-black/5" />
            {/* Scan / add-bond CTA */}
            <div className="h-20 shrink-0 animate-pulse rounded-3xl bg-black/5" />
            {/* Allocation card fills the rest */}
            <div className="min-h-0 flex-1 animate-pulse rounded-3xl bg-black/5" />
          </div>
        </div>
      </div>
    </div>
  );
}
