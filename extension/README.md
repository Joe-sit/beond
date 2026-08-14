# beond — e-Filing autofill (Chrome MV3)

Takes the 40(4) rows the beond web app has aggregated from confirmed 50 ทวิ
slips and helps enter them into e-Filing (efiling.rd.go.th).

Rebuilt 2026-08-14. The original lived outside git in `~/Downloads` and was
lost; it now ships inside the repo so it can't disappear again.

## Load it

1. `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → pick this `extension/` folder
3. Open the beond app → **สรุปประจำปี** → **ส่งเข้า e-Filing**. The card detects
   the extension via a PING and the button writes the rows into its storage.
4. Click the toolbar icon to confirm the rows arrived.

## How the pieces talk

```
beond app  ──window.postMessage──▶  content/bridge.js  ──chrome.storage.local──▶  content/efiling.js
 (src/lib/efilingSync.ts)              (marker "beond-efiling")                     (panel on efiling.rd.go.th)
```

- `src/lib/efilingSync.ts` in the app builds `EfilingRow[]` (one row per payer,
  confirmed slips only, 13-digit payer id required) and posts them.
- `content/bridge.js` runs on the app's own origins, re-validates every field,
  and stores the rows under `beond_bond_data`. Changing the message shape means
  changing both files together.
- `content/efiling.js` renders the panel on the RD site.

## Why the panel asks you to map fields

The RD form is not a stable public DOM — ids are generated, and the layout
differs between tax years and between the list and edit views. Hard-coded
selectors would silently fill the wrong box, which on a tax filing is worse than
filling nothing. So the panel is taught once:

**จับคู่ช่อง** → click the four fields in order (ชื่อผู้จ่าย, เลขผู้เสียภาษี,
เงินได้, ภาษีหัก ณ ที่จ่าย). The selectors are stored per page path, and
**กรอกแถวนี้** then writes each row into them. Every value also has a คัดลอก
button, so manual entry always works even if the mapping drifts.

Values are written through the native `value` setter plus `input`/`change`
events — assigning `.value` alone leaves a framework-controlled form submitting
its old state.

## Before publishing

- [ ] Confirm the prod origin in `manifest.json` matches the deployed domain
      (currently `https://beond-dashboard.vercel.app`).
- [ ] Walk one real filing end to end and note the mapped selectors; if they
      turn out to be stable, ship them as defaults so most users never map.
- [ ] Fill in `CHROME_STORE_URL` in `src/components/home2/YearlySummaryView.tsx`
      once the listing exists.
