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

## How the boxes are found

**กรอกทั้งหมด** fills every payer in one click, with nothing taught to the panel
first. The RD form is an Angular app with generated ids, so `content/autodetect.js`
finds the boxes the way a person does — by reading the Thai caption beside each
one (`label[for]`, `aria-label`, `mat-form-field`, a table's header cell…) and
grouping them into one block per payer. If the form shows fewer rows than there
are payers, its own "เพิ่มรายการ" button is pressed and the page re-scanned.

Two fallbacks sit behind that, because a filing is not a place to be clever and
wrong:

1. **จับคู่ช่องเอง** — click the four fields in order (ชื่อผู้จ่าย, เลขผู้เสียภาษี,
   เงินได้, ภาษีหัก ณ ที่จ่าย). Stored per page path.
2. **คัดลอก** on every value, so manual entry always works.

When detection finds nothing the panel offers **คัดลอกโครงสร้างฟอร์ม**, which
copies the page's input captions (no typed values) to the clipboard — paste that
into an issue and the patterns in `autodetect.js` can be widened.

Values are written through the native `value` setter plus `input`/`change`
events — assigning `.value` alone leaves a framework-controlled form submitting
its old state.

## Before publishing

- [x] Prod origin in `manifest.json` matches the deployed domain
      (`https://beond-dashboard.vercel.app`).
- [x] Privacy policy — the store's required URL is
      `https://beond-dashboard.vercel.app/privacy`
      (`src/components/PrivacyPolicy.tsx`; §9 is about this extension and says
      the rows never leave the machine).
- [x] Listing copy, permission justifications and data-safety answers:
      `store/LISTING.md` (Thai + English, ready to paste).
- [x] Screenshots: `npm run shots:ext` writes 1280x800 shots of the real popup
      and the real panel into `store/screenshots/`. The panel is photographed
      over `store/demo-form.html` — a plain form that labels itself a demo,
      because a store screenshot must never pass itself off as the Revenue
      Department's site.
- [ ] A reviewer test account. The app signs in with LINE, so a reviewer cannot
      make one; without it they can only see the panel's empty state.
- [ ] Walk one real filing end to end and note the mapped selectors; if they
      turn out to be stable, ship them as defaults so most users never map.
- [ ] Fill in `CHROME_STORE_URL` once the listing exists — three places:
      `src/components/home2/YearlySummaryView.tsx`,
      `src/components/landing/BentoFeatures.tsx`,
      `src/components/landing/LandingPage.tsx`.
