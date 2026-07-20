import { useEffect, useMemo, useState } from "react";
import { IconPlus } from "@tabler/icons-react";
import type { AuthProfile } from "../../lib/auth";
import { useTaxCredits, useTimeline, useJustConfirmed, notifyPortfolioChanged, matchConfirmedPayouts, currentTaxYearBE } from "../../hooks/usePortfolio";
import SidebarRail, { type View } from "./SidebarRail";
import HeroCard from "./HeroCard";
import PortfolioCard from "./PortfolioCard";
import TimelineCard from "./TimelineCard";
import MonthlySlipColumn from "./MonthlySlipColumn";
import MatchCelebration, { type CelebrationPayout } from "./MatchCelebration";
import TaxCollectionPanel from "./TaxCollectionPanel";
import SettingsPanel from "../SettingsPanel";
import AddBondModal from "../AddBondModal";
import DashboardSkeleton from "../DashboardSkeleton";
import slipFolder from "../../assets/slip-folder.png";

// Redesigned dashboard: left icon rail + a two-column home (hero/portfolio row,
// then timeline + monthly-slip column). Tax and settings reuse existing panels.
export default function DashboardShell({ profile, onLogout }: { profile: AuthProfile; onLogout: () => void }) {
  const [view, setView] = useState<View>("home");
  const [addOpen, setAddOpen] = useState(false);
  const { docs, loading: docsLoading } = useTaxCredits();
  const { months, loading: tlLoading } = useTimeline();

  // Refund gauge — the tax reclaimable this year:
  //   total (green + grey) = WHT that WILL be withheld across this year's coupons
  //     of the bonds the user holds (each coupon × 15%)
  //   green = WHT of the coupons whose 50-ทวิ slip is already photographed (matched)
  const { confirmed, pending } = useMemo(() => {
    const yearBE = String(currentTaxYearBE());
    const matched = matchConfirmedPayouts(months, docs);
    let total = 0;
    let done = 0;
    for (const m of months) {
      if (m.year !== yearBE) continue;
      for (const p of m.payouts) {
        const wht = Math.round(p.amount * 0.15);
        total += wht;
        if (matched.has(p.id)) done += wht;
      }
    }
    return { confirmed: done, pending: total - done };
  }, [months, docs]);

  // Story beat: when a slip newly matches its coupon, celebrate it centre-screen.
  const justConfirmed = useJustConfirmed(months, docs);
  const [celebrate, setCelebrate] = useState<CelebrationPayout | null>(null);
  useEffect(() => {
    if (!justConfirmed.size) return;
    const id = [...justConfirmed][0];
    for (const m of months) {
      const p = m.payouts.find((pp) => pp.id === id);
      if (p) {
        setCelebrate({ symbol: p.symbol, issuer: p.issuer, installment: p.installment });
        return;
      }
    }
  }, [justConfirmed, months]);

  // While portfolio data is still loading, show the data skeleton (except on
  // Settings, which needs no data). `?skeleton` forces it for previewing.
  const forceSkeleton = new URLSearchParams(window.location.search).has("skeleton");
  if ((forceSkeleton || tlLoading || docsLoading) && view !== "settings") {
    return (
      <>
        <SidebarRail view={view} onSelect={setView} />
        <DashboardSkeleton railSpace />
      </>
    );
  }

  return (
    <div className="min-h-dvh bg-surface pb-20 lg:pl-[64px]">
      <SidebarRail view={view} onSelect={setView} />

      <main className="p-4">
        {view === "home" && (
          <div className="flex flex-col gap-4">
            {/* Top row: hero + portfolio (727:577 in the design) */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_0.8fr]">
              <HeroCard confirmed={confirmed} pending={pending} />
              <PortfolioCard />
            </div>
            {/* Full-width timeline on top, monthly-slip table underneath. */}
            <TimelineCard onManage={() => setView("tax")} />
            <MonthlySlipColumn />
          </div>
        )}

        {view === "tax" && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_0.8fr]">
              <HeroCard confirmed={confirmed} pending={pending} />
              <PortfolioCard />
            </div>
            <div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
                <TaxCollectionPanel />
                {/* Decorative slip-folder illustration (Figma node 740:7492) */}
                <div className="hidden items-end justify-center overflow-hidden lg:flex">
                  <img src={slipFolder} alt="" className="pointer-events-none w-full max-w-[360px] object-contain" />
                </div>
              </div>
            </div>
          </div>
        )}

        {view === "settings" && (
          <div className="mx-auto max-w-2xl rounded-3xl bg-white p-4 sm:p-6">
            <SettingsPanel profile={profile} onLogout={onLogout} />
          </div>
        )}
      </main>

      {/* FAB — add a bond */}
      <button
        onClick={() => setAddOpen(true)}
        aria-label="เพิ่มหุ้นกู้"
        className="fixed right-5 bottom-24 z-40 flex size-14 items-center justify-center rounded-full bg-brand text-white shadow-lg transition active:scale-95 lg:bottom-8"
      >
        <IconPlus size={28} />
      </button>

      <AddBondModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={notifyPortfolioChanged} />

      {celebrate && <MatchCelebration payout={celebrate} onDone={() => setCelebrate(null)} />}
    </div>
  );
}
