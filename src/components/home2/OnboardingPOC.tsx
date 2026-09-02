import OnboardingFlow from "./OnboardingFlow";

/**
 * `?onboard` — walk the first-run flow without an empty account. Renders the
 * same component the dashboard does, so anything tuned here lands in the real
 * flow. `holdingCount` is 0 so the add-bond step shows its empty state.
 */
export default function OnboardingPOC() {
  return (
    <div className="h-dvh bg-[#EEF1F5] p-3 font-kanit lg:p-6">
      <OnboardingFlow holdingCount={0} />
    </div>
  );
}
