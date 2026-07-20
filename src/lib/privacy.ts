import { useSyncExternalStore } from "react";

// Global "hide amounts" toggle — the eye button on the portfolio summary card
// masks every ฿ value across the dashboard (summary, allocation legend, pillar
// tooltip), so one tap hides all money at once.
let hidden = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function toggleAmountsHidden(): void {
  hidden = !hidden;
  emit();
}

export function useAmountsHidden(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => hidden,
  );
}
