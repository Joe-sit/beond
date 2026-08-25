import OnboardingFlow from "./OnboardingFlow";

/**
 * `?onboard` — walk the first-run flow without an empty account. Renders the
 * same component the dashboard does, so anything tuned here lands in the real
 * flow. `holdingCount` is 0 so the add-bond step shows its empty state.
 */
export default function OnboardingPOC() {
  return (
    <OnboardingFlow
      profile={{ displayName: "joeomlet_xd" }}
      holdingCount={0}
      potentialWht={18000}
      onDone={() => window.location.assign("/?v2")}
    />
  );
}
