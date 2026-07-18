import { IconSmartHome, IconChartBar, IconWallet } from "@tabler/icons-react";
import type { AuthProfile } from "../../lib/auth";
import wordmark from "../../assets/landing-logo.svg?raw";

const SECTIONS = [IconSmartHome, IconChartBar, IconWallet];
const Bar = ({ className = "" }: { className?: string }) => (
  <div className={`rounded-full bg-black/10 ${className}`} />
);

// Loading skeleton that mirrors the reworked home (brand, avatar, left nav,
// folder card + slip stack) so nothing shifts once data arrives.
export default function HomeReworkSkeleton({ profile }: { profile: AuthProfile }) {
  return (
    <div className="relative h-dvh overflow-hidden bg-surface font-kanit">
      {/* Brand */}
      <div className="pointer-events-none fixed top-8 left-10 z-30 leading-tight text-[#43507F]">
        <span
          className="block h-4 w-auto [&_svg]:h-full [&_svg]:w-auto"
          style={{ ["--fill-0" as string]: "#43507F" }}
          aria-hidden
          dangerouslySetInnerHTML={{ __html: wordmark }}
        />
        <p className="mt-0.5 text-[10px] font-medium text-[#43507F]/60">Bring Your Bonds Beyond</p>
      </div>

      {/* Avatar */}
      <div className="fixed top-8 right-10 z-30">
        {profile.pictureUrl ? (
          <img src={profile.pictureUrl} alt="" className="size-14 rounded-full border border-black/10 object-cover" />
        ) : (
          <div className="size-14 animate-pulse rounded-full bg-black/10" />
        )}
      </div>

      {/* Left nav (real) */}
      <nav className="fixed top-1/2 left-10 z-30 flex -translate-y-1/2 flex-col items-center gap-6 rounded-full border border-black/10 bg-white px-4 py-8">
        {SECTIONS.map((Icon, i) => (
          <div
            key={i}
            className={`flex size-14 items-center justify-center rounded-full ${
              i === 0 ? "bg-[#43507F] text-white" : "bg-[#43507F]/10 text-[#43507F]/50"
            }`}
          >
            <Icon size={24} />
          </div>
        ))}
      </nav>

      <section className="flex min-h-dvh items-center px-6 lg:pl-40 lg:pr-24">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 lg:grid-cols-2">
          {/* Left column */}
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-2xl font-medium text-ink">หน้าหลัก</h1>
              <p className="mt-1 text-base text-ink/60">ตรวจสอบสลิปการได้รับดอกเบี้ยหุ้นกู้ของเดือน</p>
            </div>

            <div className="relative w-full max-w-[449px] animate-pulse">
              {/* White card trapezoid (same path as the real card) */}
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 449 320" preserveAspectRatio="none" aria-hidden>
                <path
                  d="M24,0 L425,0 Q449,0 447.32,23.94 L428.23,296.06 Q426.55,320 402.55,320 L46.45,320 Q22.45,320 20.77,296.06 L1.680,23.94 Q0,0 24,0 Z"
                  fill="#FFFFFF"
                />
              </svg>

              {/* Header placeholders */}
              <div className="relative flex items-start justify-between px-8 pt-6 pb-8">
                <div className="space-y-3">
                  <Bar className="h-4 w-28" />
                  <Bar className="h-9 w-24" />
                  <Bar className="h-4 w-32" />
                </div>
                <div className="space-y-2 text-right">
                  <Bar className="ml-auto h-3.5 w-20" />
                  <Bar className="ml-auto h-6 w-24" />
                </div>
              </div>

              {/* Folder region */}
              <div className="relative">
                {/* month tab */}
                <div className="absolute right-8 bottom-full z-10 flex w-[190px] items-center gap-2 rounded-t-2xl border border-b-0 border-black/10 bg-white p-2">
                  <div className="size-8 rounded-full bg-black/10" />
                  <Bar className="h-4 flex-1" />
                  <div className="size-8 rounded-full bg-black/10" />
                </div>

                <div className="relative min-h-[240px]">
                  <svg className="absolute inset-0 h-full w-full" viewBox="0 0 449 240" preserveAspectRatio="none" aria-hidden>
                    <path
                      d="M24,0 L425,0 Q449,0 446.77,23.90 L428.78,216.10 Q426.55,240 402.55,240 L46.45,240 Q22.45,240 20.22,216.10 L2.234,23.90 Q0,0 24,0 Z"
                      fill="#FF8D27"
                    />
                  </svg>
                  <div className="relative flex flex-col gap-4 px-8 py-6">
                    {[0, 1].map((i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="size-10 rounded-full bg-white/40" />
                          <div className="space-y-2">
                            <div className="h-4 w-24 rounded-full bg-white/40" />
                            <div className="h-3 w-16 rounded-full bg-white/30" />
                          </div>
                        </div>
                        <div className="h-7 w-16 rounded-xl bg-white/30" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right column — slip stack */}
          <div className="flex justify-center lg:translate-x-24 lg:translate-y-10">
            <div className="relative mx-auto h-[600px] w-[520px] animate-pulse" style={{ perspective: 2800, transformStyle: "preserve-3d" }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="absolute top-28 left-6 aspect-[210/297] w-[310px] overflow-hidden border border-black/10 bg-white"
                  style={{
                    transform: `translate3d(${i * 84}px, ${-i * 52}px, ${-i * 80}px) rotateY(-22deg) rotateX(6deg)`,
                    zIndex: 3 - i,
                  }}
                >
                  <div className="flex h-full flex-col gap-4 p-6">
                    <div className="flex items-center gap-3">
                      <div className="size-11 rounded-full bg-black/10" />
                      <div className="flex-1 space-y-2">
                        <Bar className="h-4 w-24" />
                        <Bar className="h-3 w-16" />
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <Bar className="h-8 flex-1" />
                      <Bar className="h-8 flex-1" />
                    </div>
                    <Bar className="mt-2 h-40 w-full" />
                    <div className="mt-auto flex items-center justify-between">
                      <Bar className="h-3 w-16" />
                      <Bar className="h-6 w-24" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
