import type { TaxDoc } from "../hooks/usePortfolio";

// One 40(4) income row as the beond browser extension expects it (matches the
// extension's `beond_bond_data` schema — see beond-extension/README.md). The
// extension autofills these into efiling.rd.go.th, one row per payer.
export interface EfilingRow {
  issuer_name: string;
  issuer_tax_id: string;
  gross_interest: number;
  wht_amount: number;
}

// Envelope for the window→extension bridge (content script `bridge.js`). The
// extension only trusts messages with this exact marker + our own origin.
const BRIDGE_MARKER = "beond-efiling";

// Aggregate a tax year's slips into per-payer 40(4) rows. e-Filing groups income
// by payer (ผู้จ่ายเงินได้), so multiple coupons from one issuer collapse into a
// single row with summed gross + withholding. Only `confirmed` slips count —
// pending/unverified must never enter a real filing. Rows without a payer tax id
// can't be filed, so they're dropped (caller surfaces the count).
export function buildEfilingRows(docs: TaxDoc[], taxYear: number): EfilingRow[] {
  const byPayer = new Map<string, EfilingRow>();

  for (const d of docs) {
    if (d.status !== "confirmed") continue;
    if (d.taxYear !== taxYear) continue;
    const taxId = (d.payerTaxId ?? "").replace(/\D/g, "");
    if (taxId.length !== 13) continue; // needs a valid 13-digit payer id to file

    const row = byPayer.get(taxId);
    if (row) {
      row.gross_interest += d.grossAmount ?? 0;
      row.wht_amount += d.whtAmount ?? 0;
    } else {
      byPayer.set(taxId, {
        issuer_name: d.payerName ?? d.symbol ?? "",
        issuer_tax_id: taxId,
        gross_interest: d.grossAmount ?? 0,
        wht_amount: d.whtAmount ?? 0,
      });
    }
  }

  return [...byPayer.values()].map((r) => ({
    ...r,
    gross_interest: Math.round(r.gross_interest * 100) / 100,
    wht_amount: Math.round(r.wht_amount * 100) / 100,
  }));
}

// How many confirmed slips in a year can't be filed (missing/short payer tax id)
// — shown as a warning so the user knows some slips were skipped.
export function countUnfilable(docs: TaxDoc[], taxYear: number): number {
  return docs.filter(
    (d) =>
      d.status === "confirmed" &&
      d.taxYear === taxYear &&
      (d.payerTaxId ?? "").replace(/\D/g, "").length !== 13,
  ).length;
}

// Round-trip a message to the extension bridge and resolve its ack (or false on
// timeout). Used both for presence detection (PING) and the actual sync.
function bridgeRequest(type: string, payload?: unknown, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const nonce = Math.random().toString(36).slice(2);
    const onAck = (e: MessageEvent) => {
      if (e.source !== window) return;
      const d = e.data;
      if (d?.marker === BRIDGE_MARKER && d?.dir === "ack" && d?.nonce === nonce) {
        cleanup();
        resolve(Boolean(d.ok));
      }
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);
    function cleanup() {
      clearTimeout(timer);
      window.removeEventListener("message", onAck);
    }
    window.addEventListener("message", onAck);
    window.postMessage({ marker: BRIDGE_MARKER, dir: "req", type, nonce, payload }, window.location.origin);
  });
}

// Is the beond extension installed + its bridge active on this page?
export function detectExtension(): Promise<boolean> {
  return bridgeRequest("PING", undefined, 800);
}

// Push rows into the extension's storage. Resolves true once the bridge acks the
// write; false if the extension isn't there or didn't respond.
export function syncToExtension(rows: EfilingRow[]): Promise<boolean> {
  return bridgeRequest("SYNC_BONDS", rows, 2500);
}
