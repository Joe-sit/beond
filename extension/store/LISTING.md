# Chrome Web Store listing — beond e-Filing autofill

Everything the developer dashboard asks for, written out so submitting is a
copy/paste job. Keep it in step with `manifest.json`: if a permission or a host
changes here, it changes there too, and the justification below has to still be
true.

Assets in this folder: `screenshots/` (1280×800, produced by
`node scripts/make-store-shots.mjs`), `logo-300.png`, and the icons the manifest
already ships (`../icons/icon-128.png` is the store icon).

---

## Store fields

| Field | Value |
| --- | --- |
| Item name | beond — e-Filing autofill |
| Category | Productivity |
| Language | ไทย (Thai) |
| Privacy policy URL | https://beond-dashboard.vercel.app/privacy |
| Support / homepage URL | https://beond-dashboard.vercel.app/ |
| Support email | beond.support@gmail.com |

### Summary (≤132 characters)

**ไทย**

> กรอกดอกเบี้ยหุ้นกู้ 40(4) ลง e-Filing จากสลิป 50 ทวิ ที่คุณยืนยันไว้ในแอป beond แล้ว

**English**

> Fills your Thai 40(4) bond-interest figures into e-Filing, from the 50 ทวิ slips you already confirmed in beond.

### Detailed description

**ไทย**

> ยื่นภาษีเงินได้จากดอกเบี้ยหุ้นกู้ โดยไม่ต้องพิมพ์เลขเองทีละช่อง
>
> ถ้าคุณลงทุนในหุ้นกู้ ทุกงวดดอกเบี้ยจะมีหนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ) หนึ่งใบ พอถึงเวลายื่นภาษี คุณต้องนั่งพิมพ์ชื่อผู้จ่าย เลขประจำตัวผู้เสียภาษี 13 หลัก จำนวนเงินได้ และภาษีที่ถูกหักไว้ ลงในแบบ ภ.ง.ด. ทีละราย ซึ่งพิมพ์ผิดง่ายและเสียเวลา
>
> ส่วนขยายนี้ทำงานคู่กับแอป beond (beond-dashboard.vercel.app) ที่รวบรวมสลิป 50 ทวิ ของคุณไว้ตลอดปี เมื่อคุณกด “ส่งเข้า e-Filing” ในหน้าสรุปประจำปี ตัวเลขที่คุณยืนยันแล้วจะถูกส่งมาเก็บไว้ในเบราว์เซอร์ของคุณ แล้วเมื่อเปิดหน้า e-Filing ของกรมสรรพากร จะมีแผงเล็ก ๆ ขึ้นที่มุมจอ พร้อมกรอกให้
>
> วิธีใช้
> 1. เปิดแอป beond → สรุปประจำปี → กด “ส่งเข้า e-Filing”
> 2. เปิด efiling.rd.go.th แล้วเข้าหน้ากรอกเงินได้มาตรา 40(4)
> 3. กด “กรอกทั้งหมด” ในแผง — จบ
>
> ส่วนขยายหาช่องกรอกเองจากคำกำกับภาษาไทยข้างช่อง ไม่ต้องตั้งค่าอะไรก่อน ถ้าฟอร์มมีแถวน้อยกว่าจำนวนผู้จ่าย จะกดปุ่ม “เพิ่มรายการ” ของฟอร์มเองให้
>
> เผื่อกรณีหาไม่เจอ — แบบฟอร์มของกรมสรรพากรเปลี่ยนโครงสร้างได้ตามปีภาษีและตามหน้า ถ้าวันหนึ่งหาช่องไม่เจอ ยังมีปุ่ม “จับคู่ช่องเอง” ให้คลิกบอกตำแหน่ง 4 ช่องครั้งเดียว และทุกค่ามีปุ่ม “คัดลอก” ให้วางเองได้เสมอ
>
> ความเป็นส่วนตัว
> • ข้อมูลถูกเก็บไว้ในเครื่องคุณเท่านั้น (chrome.storage.local) ส่วนขยายไม่ส่งข้อมูลออกไปที่เซิร์ฟเวอร์ใดทั้งสิ้น ทั้งของเราและของบุคคลที่สาม
> • ทำงานเฉพาะบนหน้าเว็บของ beond และ efiling.rd.go.th เท่านั้น ไม่อ่านเว็บอื่น ไม่เก็บประวัติการเข้าชม
> • ไม่มีการโหลดโค้ดจากภายนอกมารัน ไม่มีโฆษณา ไม่มีการติดตาม
> • ถอนการติดตั้ง = ข้อมูลที่เก็บไว้หายทั้งหมด
>
> ส่วนขยายนี้ไม่มีส่วนเกี่ยวข้องกับกรมสรรพากร เป็นเครื่องมือของผู้ใช้เองที่ช่วยกรอกข้อมูลของตัวคุณลงในแบบฟอร์มที่คุณเปิดอยู่

**English**

> File the tax on your bond interest without retyping every figure.
>
> Every bond coupon in Thailand comes with a withholding-tax certificate (50 ทวิ). At filing time you copy the payer's name, their 13-digit tax id, the interest and the tax withheld into the return, one payer at a time — slow, and easy to mistype.
>
> This extension is the companion to the beond app (beond-dashboard.vercel.app), which collects those certificates through the year. Press "ส่งเข้า e-Filing" on the yearly summary and the figures you already confirmed are stored in your own browser. Open the Revenue Department's e-Filing site and a small panel appears in the corner, ready to fill them in.
>
> How it works
> 1. In beond, open the yearly summary and press "ส่งเข้า e-Filing".
> 2. Open efiling.rd.go.th and go to the section 40(4) income page.
> 3. Press "กรอกทั้งหมด" — done.
>
> The extension finds the boxes itself, by reading the Thai caption beside each one, and presses the form's own "add row" button when there are more payers than rows.
>
> If a future version of the form defeats that, "จับคู่ช่องเอง" lets you click the four fields once, and every value keeps a copy button as a fallback that cannot break.
>
> Privacy
> • Your data stays on your machine (chrome.storage.local). The extension sends nothing to any server, ours or anyone else's.
> • It runs only on beond's own pages and on efiling.rd.go.th. No other site is read, no browsing history is kept.
> • No remote code, no ads, no tracking.
> • Uninstalling deletes everything it stored.
>
> Not affiliated with the Revenue Department. It is a user-side tool that types your own figures into a form you already have open.

---

## Single purpose

> Fill the Thai section 40(4) bond-interest figures a user has already confirmed
> in the beond web app into the Revenue Department's e-Filing form, on the
> user's own machine.

## Permission justifications

| Permission | Why it is needed |
| --- | --- |
| `storage` | Holds the 40(4) rows the beond app hands over, plus the per-page field mapping the user teaches. Nothing else is stored, and it never leaves `chrome.storage.local`. |
| `clipboardWrite` | Every value in the panel has a "คัดลอก" (copy) button, so a user can paste a figure by hand when they would rather not autofill. |
| Host: `https://beond-dashboard.vercel.app/*` (and `localhost` for development) | The app page posts the user's confirmed rows to the extension over `window.postMessage`; the content script on that origin validates and stores them. Without it there is nothing to fill. |
| Host: `https://efiling.rd.go.th/*` | Draws the panel beside the form and writes the values into the fields the user mapped. This is the site the extension exists for. |

**Remote code:** none. All JavaScript ships in the package; nothing is fetched
or evaluated at runtime.

## Data safety declarations

Answer "No" to every collection category. The extension:

- does not collect, transmit or sell any user data;
- stores the user's own tax figures locally, only until they uninstall or the
  app syncs new ones;
- contains no analytics, no ads, no tracking, and no remote code.

Privacy policy: https://beond-dashboard.vercel.app/privacy (section 9 covers
this extension specifically).

---

## Notes for the reviewer

Paste this into "Notes to reviewer" so the panel can be verified without a Thai
tax account:

> The extension is a companion to beond (beond-dashboard.vercel.app) and shows
> the user's own figures. To review it without an account:
>
> 1. Open https://efiling.rd.go.th — the panel appears bottom-right with the
>    empty state "ยังไม่มีข้อมูล" (no data yet). This confirms the content
>    script and its scope.
> 2. Click the toolbar icon — the popup shows the same empty state.
> 3. For the filled state, sign in to the app with the test account below,
>    open "สรุปประจำปี" and press "ส่งเข้า e-Filing"; the rows then appear in
>    the popup and the panel.
>
> Test account: **&lt;TODO: create one before submitting&gt;**

**Open item:** the app signs in with LINE Login, so a reviewer cannot register
one themselves. Before submitting, either provision a test account whose
credentials can be shared, or add a review-only sign-in path. The empty-state
walkthrough above is enough to demonstrate scope, but not the fill itself.
