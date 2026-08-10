# beond — Business Logic

Financial rules the app must honour. Numbers shown to users are money — they have
to match the issuer's real documents (50-ทวิ slips) and the Revenue Department's
tax method, not a convenient approximation.

## 1. Coupon interest accrual — actual/365 day-count

Bond coupon interest accrues on the **actual number of days in each coupon
period**, on a 365-day year. It is **not** a flat division of the annual rate.

```
coupon = faceValue × (couponRate / 100) × (daysInPeriod / 365)
```

- `daysInPeriod` = days from the previous coupon date to this one; for the
  **first** coupon it runs from the bond's **issue date** to the first coupon
  date.
- Regular semiannual periods are ~182–183 days (not 182.5), so consecutive
  coupons are **not identical**.
- The **first (and sometimes last) period is a stub** — shorter or longer than a
  full half-year — so that coupon differs from the rest.
- Over a full year the day fractions sum to 1, so the annual total still equals
  `faceValue × rate`. Only the per-coupon split changes.

**Why it matters:** the old code used `faceValue × rate / frequency` (flat,
equal every period). That over/under-stated each coupon by the day-count
difference. Example — BTSG208A, face ฿200,000, 3.6% semiannual, a 182-day
period:

| method | coupon (gross) |
|---|---|
| flat `face×rate/2` | 3,600.00 |
| actual/365 (`×182/365`) | **3,590.14** ← matches the real slip |

Implemented in [src/lib/couponSchedule.ts](../src/lib/couponSchedule.ts)
(`deriveCouponSchedule`). Keep amounts to 2 decimals (satang) — never round the
gross to a whole baht, or WHT/net drift from the slip.

## 2. Withholding tax (WHT) & net — the slip's own arithmetic

Bond coupon interior (40(4)) is withheld at a **flat 15%** at source. Net follows
the 50-ทวิ slip: round the WHT to satang first, then subtract.

```
wht = round(gross × 0.15, 2)
net = gross − wht
```

Do not compute net as `gross × 0.85` — it can differ by a satang from the slip.

## 3. Refund estimate — progressive ("stair") tax

Thai personal income tax is **progressive on total net income**: each bracket
taxes only the slice of income that falls inside it. Bond interest is stacked on
top of the person's other income, so it is taxed by the brackets it climbs
through — not a flat `interest × marginalRate`.

The app knows only the user's **marginal bracket** (it does not collect other
income), so it assumes the other income sits at the **floor of that bracket** and
taxes the interest as the slice above it:

```
floor          = bracketFloor(marginalRate)
taxOnInterest  = progressiveTax(floor + interest) − progressiveTax(floor)
refund         = max(0, totalWht − taxOnInterest)
```

- rate < 15% → usually over-withheld → positive refund
- rate ≥ 15% → interest lands at/above the 15% WHT → refund is 0

`progressiveTax()` and `estimatedRefund()` live in
[src/lib/taxSettings.ts](../src/lib/taxSettings.ts). Verified against the
Finnomena worked example: `progressiveTax(440,000) = 21,500`.

## 4. Estimate vs. real slip

- Before a coupon is confirmed by a scanned slip, the schedule value (§1) is an
  **estimate**.
- A confirmed 50-ทวิ slip (`tax_documents.gross_amount` / `wht_amount`) is the
  **authoritative** figure once available.

## 5. Data integrity — deleting a holding

Deleting a holding removes its accumulated slips: `tax_documents.holding_id` is
`on delete cascade` (migration `0022`), and the app also deletes slips by
`bond_id` to catch any linked only that way. The delete confirmation warns the
user how many slips will go with it.
