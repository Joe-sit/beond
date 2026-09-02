// Bridge between the beond web app and this extension.
//
// The app has no way to talk to an extension directly, so it posts a window
// message and we relay it into extension storage. Contract (mirrored in the
// app's src/lib/efilingSync.ts — change both together):
//
//   app  → { marker: "beond-efiling", dir: "req", type, nonce, payload }
//   here → { marker: "beond-efiling", dir: "ack", nonce, ok }
//
// Types: PING (presence check) and SYNC_BONDS (payload = EfilingRow[]).

const MARKER = "beond-efiling";
const STORAGE_KEY = "beond_bond_data";

// Only ever trust same-window messages carrying our marker. Any page can post
// into its own window, so the payload is validated field by field below before
// anything is stored — a rogue script must not be able to plant filing figures.
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const msg = event.data;
  if (!msg || msg.marker !== MARKER || msg.dir !== "req") return;

  const ack = (ok) =>
    window.postMessage({ marker: MARKER, dir: "ack", nonce: msg.nonce, ok }, window.location.origin);

  if (msg.type === "PING") {
    ack(true);
    return;
  }

  if (msg.type === "SYNC_BONDS") {
    const rows = sanitizeRows(msg.payload);
    if (!rows) {
      ack(false);
      return;
    }
    // Reloading the extension orphans the copy of this script already running
    // in open tabs: every chrome.* call then throws "Extension context
    // invalidated". Nothing here can recover from that — the page has to be
    // reloaded — so it is reported as a failed sync instead of an uncaught
    // error the user has to interpret.
    try {
      chrome.storage.local.set(
        { [STORAGE_KEY]: rows, beond_synced_at: Date.now(), beond_origin: window.location.origin },
        () => ack(!chrome.runtime.lastError),
      );
    } catch {
      ack(false);
    }
    return;
  }

  ack(false);
});

// The only host a payer logo may come from. The URL is loaded by the panel on
// efiling.rd.go.th, so an arbitrary one would be a beacon telling its owner who
// is on the filing page and when — accepting any https URL here would hand that
// to whatever posted the message.
const LOGO_HOST = "img.logo.dev";

function sanitizeLogo(value) {
  if (typeof value !== "string" || value.length > 500) return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && u.hostname === LOGO_HOST ? u.href : null;
  } catch {
    return null;
  }
}

// Accept only well-formed 40(4) rows: a 13-digit payer id and finite,
// non-negative amounts. Anything else is dropped whole rather than partially
// stored — a half-filled tax figure is worse than none.
function sanitizeRows(payload) {
  if (!Array.isArray(payload)) return null;
  const out = [];
  for (const r of payload) {
    if (!r || typeof r !== "object") return null;
    const taxId = String(r.issuer_tax_id ?? "").replace(/\D/g, "");
    const gross = Number(r.gross_interest);
    const wht = Number(r.wht_amount);
    if (taxId.length !== 13) return null;
    if (!Number.isFinite(gross) || !Number.isFinite(wht) || gross < 0 || wht < 0) return null;
    out.push({
      issuer_name: String(r.issuer_name ?? "").slice(0, 200),
      issuer_tax_id: taxId,
      gross_interest: Math.round(gross * 100) / 100,
      wht_amount: Math.round(wht * 100) / 100,
      // Optional and never fatal: a bad logo drops to a monogram rather than
      // rejecting a row whose figures are fine.
      logo_url: sanitizeLogo(r.logo_url),
    });
  }
  return out;
}
