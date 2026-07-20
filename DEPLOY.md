# Deploy — Phase 0 (single Supabase = prod)

Get the LINE rich-menu → LIFF scan flow live fast. Harden (staging/CI) later.

## 1. Frontend → Vercel
Vercel auto-detects Vite. Set these **Environment Variables** (Production) — all
are public/client-safe (RLS protects the DB):

| var | source |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (publishable) key |
| `VITE_LIFF_ID` | LINE LIFF app id (step 2) |
| `VITE_LOGODEV_TOKEN` | logo.dev publishable token |

- Import the GitHub repo in Vercel → Deploy. `vercel.json` handles SPA routing
  (so `/admin` works on refresh).
- Note the prod URL, e.g. `https://beond.vercel.app` (or a custom domain).

## 2. LIFF (LINE console)
- LINE Developers → your Messaging channel → LIFF → **Add**.
- Endpoint URL = the Vercel prod URL.
- Size = Full. Scope = profile, openid.
- Copy the **LIFF ID** → put in Vercel `VITE_LIFF_ID`, redeploy.

## 3. Rich menu
- Build the 6-button menu (portfolio / scan / calendar / tax-credit / account / help).
- "scan" button action = URI → `https://liff.line.me/<LIFF_ID>` (opens the web app).
  (Sending a slip photo straight into the chat also works — that path is the
  Typhoon `line-webhook`, already live, no deploy needed.)

## 4. Browser extension (e-filing)
- Add the Vercel prod domain to the extension `manifest.json` host/match list.

## Already done / no action
- Edge fns `line-webhook` (Typhoon OCR), `health`, `ocr-extract`, `line-auth`
  deployed; secrets set; CORS = `*`.
- Slip images deleted after OCR (no national-ID retention).

## Phase 1 (later)
Staging Supabase project + Vercel preview + test OA; GitHub Actions CI
(typecheck/lint/build → deploy fns + `db push` + health smoke test); custom domain.

## Phase 2 (later)
Sentry error tracking; OCR rate-limit / queue for spikes; DB indexes
(`holdings(user)`, `tax_documents(user,tax_year)`); pgBouncer pooling review.
