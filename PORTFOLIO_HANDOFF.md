# Handoff — build my portfolio site

Paste this whole file into the new session as the first message. It captures how I like to work, the stack, and the frontend/3D patterns I want carried into my portfolio site.

---

## 0. How to talk to me

- **Replies: caveman-terse.** Drop articles/filler/hedging. Fragments fine. `[thing] [action] [reason]. [next step].` Code, commits, security warnings → write normal full prose.
- I write mixed **Thai + English**. Reply in Thai caveman; keep technical terms, code, API names, error strings verbatim.
- **Act when you have enough.** No option-surveys, no re-asking decided things. Give a recommendation, not a menu.
- Keep the dev server running after edits — don't kill it.
- After a visual change, tell me to check the real screen; don't claim it looks right without me confirming.

## 1. Hard rules (non-negotiable)

- **NO fake / hardcoded / mock data.** Ever. Real data source or empty state. If data missing → skeleton or empty state, never invented numbers.
- Money/interest/tax/income numbers → **2 decimals**; principal → whole number.
- Every clickable element → `cursor: pointer` (enforce via a global CSS selector list incl. role=button/link/menuitem/option/switch/checkbox/radio/slider).
- Secrets in gitignored `.env.local`. Dev server on **HTTPS**.
- Commit/push only when I say so. Branch off main first. Commit trailer:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

## 2. Stack

- **React 18 + TypeScript + Vite.**
- **heroUI v3** — compositional components (see §5).
- **Tailwind v4** — arbitrary values `[...]`, canonical class form (`font-normal!` not `!font-normal`, `rotate-18` not `rotate-[18deg]`, `ring-brand-blue` not `ring-[#2968a5]`). Define brand colors as tokens.
- **3D: @react-three/fiber + drei** (+ @react-three/rapier only if physics needed).
- **three.js** — orthographic cameras for clean iso/pixel look.
- **motion/react** (Motion, ex-Framer) — mount transitions, AnimatePresence. Keep it subtle.
- Custom lightweight **i18n store** (TH/EN dicts, `useT`/`useLang`/`setLang`, `{placeholder}` interpolation). No heavy i18n lib.
- Content from real files (MDX/JSON) — same "no fake data" rule, source from real content.

## 3. UX/UI taste (what "good" means to me)

- **Card roles drive padding** — don't copy one `p-N` everywhere. List-wrapper card `p-1` (rows self-space), form card `p-3`, content card `p-6`. Match padding to the card's job.
- **Header text column**: label `text-base` / title `text-3xl` / subtitle `text-sm`.
- **Buttons share one hover**: `transition hover:bg-black/5` (or brand primary `bg-brand-blue hover:<darker>`). Consistent across the app.
- **Fonts**: no `font-bold` in soft/friendly modals — cap at `font-medium`. Use named font families deliberately.
- **Separate cards read as separate** — put them on a neutral (gray) background with gaps; don't nest a white card inside another white card (they merge visually).
- **Scroll only the part that should scroll.** One inner region gets `overflow-y-auto`; everything else stays put. Requires an unbroken `min-h-0` + `flex-1` chain from the fixed-height ancestor down.
- **Debounce every typeahead** (API and local filter), cap the visible list length, cancel stale requests.
- **Fade masks**: `mask-image` on a scroll container = nice edge fade — BUT it renders solid black over a heroUI Accordion in Chrome. Keep fades off accordion containers.
- **Skeleton loading** for any async view, not spinners-in-the-void.
- **Nested route hygiene**: when a "page" opens inside the main area (add/edit panel), sidebar nav must first close that nested state, then switch view — otherwise the nav looks dead.
- Pull real layouts from **Figma** when I give a node URL (design-to-code: `get_design_context` first, adapt to our stack, reuse existing components/tokens, render real exported assets — never hand-draw SVG icons).

## 4. The debugging lesson I care most about

**When an element disappears / gets squished / renders wrong in a flex or grid layout — suspect CSS first, not the data.**

Example I got burned by: a panel "had no data." I chased data/logic for several turns and hallucinated causes. Root cause: children of a `flex-col; overflow-y-auto` parent compress to nothing without `shrink-0`. Fix was `shrink-0` on the section children.

Checklist before blaming data logic:
1. Is the flex/grid child missing `shrink-0`?
2. Is the `min-h-0` / height chain unbroken up to a fixed-height ancestor?
3. Is `overflow` clipping it?
4. Only after CSS is ruled out → inspect the data.

General style: **find the actual root cause, don't pattern-match a plausible one.** If I say "you're hallucinating," stop, re-read the real DOM/CSS/state, and verify before proposing another fix.

## 5. heroUI v3 patterns (compositional — not monolithic props)

```tsx
// Tabs
<Tabs variant="secondary">
  <Tabs.ListContainer>
    <Tabs.List aria-label="...">
      <Tabs.Tab id="a">A</Tabs.Tab>
      <Tabs.Indicator />
    </Tabs.List>
  </Tabs.ListContainer>
  <Tabs.Panel id="a">…</Tabs.Panel>
</Tabs>

// SearchField
<SearchField value={v} onChange={setV} aria-label="…" className="w-full max-w-[520px]">
  <SearchField.Group className="h-14 rounded-2xl bg-[#F0F2F5] px-4">
    <SearchField.SearchIcon />
    <SearchField.Input placeholder="…" />
    <SearchField.ClearButton />
  </SearchField.Group>
</SearchField>

// NumberField.Group { DecrementButton / Input / IncrementButton }
// Breadcrumbs / Breadcrumbs.Item (onPress steps back)
// Modal + ModalBackdrop + ModalContainer + ModalDialog
// toast.success / toast.danger  (ONE Toast.Provider only — duplicates fight)
```

## 6. 3D / three.js patterns

- **Orthographic camera** for iso/clean geometric scenes. Drive it with spherical params (`az`, `el`, `roll`) + pan (`cx`, `cy`) + `zoom`/radius — build a small `CameraRig` that applies `position` and matching `lookAt`.
- Ship a **DEV-only tuner** (sliders bound to those params) gated behind `import.meta.env.DEV`, so I can dial camera/scene by eye, then bake the constants. Gate ALL debug tools/routes with `import.meta.env.DEV`.
- Animate materials in `useFrame` — e.g. subtle shimmer `mat.emissiveIntensity = 0.1 + 0.1 * Math.sin(t * 1.6)`. Keep it minimal, no garish highlights.
- Dashed outlines: `edgesGeometry` + `lineDashedMaterial` (must call `computeLineDistances()`).
- For many small 3D tokens in a DOM grid, one `<canvas>` per token (DOM-laid-out) proved **more reliable** than a single shared canvas with a fancy camera — the single-canvas approach was WebGL-fragile. Prefer the robust version.
- Reproduce Figma-exported images/logos faithfully with a fixed-size square container + `object-cover`; don't let intrinsic size blow them up.

## 7. Project hygiene

- Run `npm run typecheck` (`tsc -b`) and `npm run lint` (e.g. `oxlint`) after edits; keep both clean. Pre-existing warnings that predate my change are fine to leave.
- Remove now-unused imports/vars immediately (TS `noUnusedLocals` will fail the build otherwise).
- `import.meta.env.DEV` gate for every POC route / debug logger / tuner.
- Use a scratchpad dir for temp files, not the repo.

## 8. Portfolio project — starting intent

Build my personal portfolio site: React + TS + Vite, heroUI, Tailwind v4, and a **real interactive 3D element** (three.js / r3f) as a hero or signature piece. Clean typographic hierarchy, separate-cards-on-gray layout, subtle motion, real content only (no lorem/fake projects — ask me for the real project data or wire it to content files). Bilingual TH/EN via the lightweight i18n store.

First step when the new session starts: confirm the stack + scaffold Vite + React-TS + Tailwind v4 + r3f, set up the i18n store and brand tokens, then we design the 3D hero.
