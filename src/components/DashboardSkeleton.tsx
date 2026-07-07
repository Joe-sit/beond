import HeroBackground from "./HeroBackground";

// First-paint skeleton — mirrors the real DashboardLayout so the shell doesn't
// jump when auth resolves: fixed left hero column (brand → income → timeline)
// and the tabbed right column (tabs + white card holding summary/scan/allocation).
export default function DashboardSkeleton() {
  return (
    <div className="relative h-screen overflow-hidden bg-[#F6F4F1]">
      <HeroBackground className="pointer-events-none absolute inset-x-0 top-0 h-[22vw] w-full" />

      <div className="relative grid h-full grid-cols-1 lg:grid-cols-2">
        {/* Left hero column — brand row, centered income headline, timeline */}
        <div className="flex h-full flex-col overflow-hidden">
          <div className="flex items-center justify-between px-8 pt-6 md:px-12">
            <div className="h-8 w-28 animate-pulse rounded-lg bg-white/30" />
            <div className="h-8 w-8 animate-pulse rounded-full bg-white/30" />
          </div>
          <div className="flex flex-col items-center px-8 pt-6">
            <div className="h-4 w-40 animate-pulse rounded bg-white/30" />
            <div className="mt-3 h-10 w-56 animate-pulse rounded-xl bg-white/40" />
          </div>
          <div className="mt-auto flex items-end gap-3 px-8 pb-10 md:px-12">
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
        <div className="flex h-full min-h-0 flex-col p-5 md:p-6">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`h-11 w-35 rounded-t-2xl ${i === 0 ? "bg-white" : "animate-pulse bg-white/40"}`}
              />
            ))}
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-4 rounded-3xl rounded-tl-none bg-white p-6 md:p-8">
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
