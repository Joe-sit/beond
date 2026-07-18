import stairs from "../assets/hero-stairs.svg";
import cloudRight from "../assets/hero-cloud-right.svg";
import cloudFar from "../assets/hero-cloud-far.svg";

// First-paint skeleton — mirrors the real DashboardShell (hero/portfolio row,
// full-width timeline, monthly-slip table) so the shell doesn't jump when data
// resolves. `railSpace` reserves room for the real sidebar rail when rendered
// inside the shell (the rail itself is never skeletonised).
export default function DashboardSkeleton({ railSpace = false }: { railSpace?: boolean }) {
  return (
    <div className={`min-h-dvh bg-surface pb-20 ${railSpace ? "lg:pl-[64px]" : ""}`}>
      <main className="flex flex-col gap-4 p-4">
        {/* Hero + portfolio row */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_0.8fr]">
          {/* Hero — gauge arc floating over a podium (min-h matches HeroCard) */}
          <div className="relative h-full min-h-42.5 overflow-hidden rounded-3xl bg-gradient-to-b from-[#779BC6]/50 to-[#F6F4F1]">
            <div className="absolute top-6 left-6 h-5 w-24 animate-pulse rounded-md bg-white/40" />
            <div className="absolute top-6 right-6 flex gap-3">
              <div className="h-5 w-20 animate-pulse rounded-md bg-white/40" />
              <div className="h-5 w-20 animate-pulse rounded-md bg-white/40" />
            </div>
            {/* gauge arc */}
            <div className="absolute top-[22%] left-1/2 h-24 w-52 -translate-x-1/2 overflow-hidden">
              <div className="h-52 w-52 animate-pulse rounded-full border-[14px] border-white/45 border-b-transparent" />
            </div>
            <div className="absolute top-[46%] left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
              <div className="h-6 w-28 animate-pulse rounded-md bg-white/50" />
              <div className="h-4 w-20 animate-pulse rounded bg-white/40" />
            </div>
            {/* real clouds + podium */}
            <img src={cloudFar} alt="" className="pointer-events-none absolute -bottom-8 -left-32 w-[52%] -scale-x-100" />
            <img src={stairs} alt="" className="pointer-events-none absolute -bottom-[80%] left-[54%] h-[112%] w-auto max-w-none -translate-x-1/2 -scale-x-100" />
            <img src={cloudRight} alt="" className="pointer-events-none absolute -right-8 -bottom-2 w-[40%]" />
          </div>

          {/* Portfolio (min-h matches PortfolioCard) */}
          <div className="relative flex h-full min-h-37.5 items-center overflow-hidden rounded-3xl bg-card p-6">
            <div className="flex flex-col gap-3">
              <div className="h-4 w-32 animate-pulse rounded bg-black/5" />
              <div className="h-8 w-44 animate-pulse rounded-lg bg-black/5" />
              <div className="mt-1 flex gap-4">
                <div className="flex flex-col gap-2">
                  <div className="h-3.5 w-20 animate-pulse rounded bg-black/5" />
                  <div className="h-6 w-14 animate-pulse rounded bg-black/5" />
                </div>
                <div className="h-11 w-px bg-black/5" />
                <div className="flex flex-col gap-2">
                  <div className="h-3.5 w-24 animate-pulse rounded bg-black/5" />
                  <div className="h-6 w-16 animate-pulse rounded bg-black/5" />
                </div>
              </div>
              <div className="mt-2 h-7 w-40 animate-pulse rounded-xl bg-black/5" />
            </div>
            {/* mascot */}
            <div className="absolute right-6 bottom-6 size-28 animate-pulse rounded-2xl bg-black/5" />
          </div>
        </div>

        {/* Timeline card */}
        <div className="rounded-3xl bg-card p-6">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-2">
              <div className="h-6 w-56 animate-pulse rounded-lg bg-black/5" />
              <div className="h-4 w-40 animate-pulse rounded bg-black/5" />
            </div>
            <div className="flex gap-2">
              <div className="h-9 w-16 animate-pulse rounded-full bg-black/5" />
              <div className="h-9 w-16 animate-pulse rounded-full bg-black/5" />
            </div>
          </div>
          <div className="mt-4 flex h-70 items-end gap-2 sm:gap-4">
            {[46, 70, 52, 88, 60, 40, 74, 50, 64, 44, 80, 56].map((h, i) => (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-3">
                <div className="w-full max-w-36 animate-pulse rounded-lg bg-black/5" style={{ height: `${h}%` }} />
                <div className="h-4 w-8 shrink-0 animate-pulse rounded bg-black/5" />
              </div>
            ))}
          </div>
        </div>

        {/* Monthly-slip table */}
        <div className="overflow-hidden rounded-3xl bg-card">
          <div className="flex items-center gap-4 border-b border-line px-4 py-3">
            {[16, 12, 28, 24, 14].map((w, i) => (
              <div key={i} className="h-4 animate-pulse rounded bg-black/5" style={{ width: `${w}%` }} />
            ))}
          </div>
          {[0, 1, 2, 3].map((r) => (
            <div key={r} className="flex items-center gap-4 border-b border-line/60 px-4 py-4 last:border-0">
              <div className="h-5 w-[16%] animate-pulse rounded bg-black/5" />
              <div className="h-8 w-[12%] animate-pulse rounded-full bg-black/5" />
              <div className="h-5 w-[28%] animate-pulse rounded bg-black/5" />
              <div className="h-5 w-[24%] animate-pulse rounded bg-black/5" />
              <div className="h-7 w-[14%] animate-pulse rounded-xl bg-black/5" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
