---
name: motion
description: |
  Build sophisticated React animations with Motion (formerly Framer Motion) - declarative animations, gestures (drag, hover, tap), scroll effects, spring physics, layout animations, and SVG manipulation. Optimize bundle size with LazyMotion (4.6 KB) or useAnimate mini (2.3 KB).

  Use when: adding drag-and-drop interactions, creating scroll-triggered animations, implementing modal dialogs with transitions, building carousels with momentum, animating page/route transitions, creating parallax hero sections, implementing accordions with smooth expand/collapse, or optimizing animation bundle sizes. For simple list animations, use auto-animate skill instead (3.28 KB vs 34 KB).

  Troubleshoot: AnimatePresence exit not working, large list performance issues, Tailwind transition conflicts, Next.js "use client" errors, scrollable container layout issues, or Cloudflare Workers build errors (resolved Dec 2024).
---

# Motion Animation Library

## Overview

Motion (package: `motion`, formerly `framer-motion`) is the industry-standard React animation library used in production by thousands of applications. With 30,200+ GitHub stars and 300+ official examples, it provides a declarative API for creating sophisticated animations with minimal code.

**Key Capabilities:**
- **Gestures**: drag, hover, tap, pan, focus with cross-device support
- **Scroll Animations**: viewport-triggered, scroll-linked, parallax effects
- **Layout Animations**: FLIP technique for smooth layout changes, shared element transitions
- **Spring Physics**: Natural, customizable motion with physics-based easing
- **SVG**: Path morphing, line drawing, attribute animation
- **Exit Animations**: AnimatePresence for unmounting transitions
- **Performance**: Hardware-accelerated, ScrollTimeline API, bundle optimization (2.3 KB - 34 KB)

**Production Tested**: React 19, Next.js 16, Vite 7, Tailwind v4

---

## When to Use This Skill

### ✅ Use Motion When:

**Complex Interactions**:
- Drag-and-drop interfaces (sortable lists, kanban boards, sliders)
- Hover states with scale/rotation/color changes
- Tap feedback with bounce/squeeze effects
- Pan gestures for mobile-friendly controls

**Scroll-Based Animations**:
- Hero sections with parallax layers
- Scroll-triggered reveals (fade in as elements enter viewport)
- Progress bars linked to scroll position
- Sticky headers with scroll-dependent transforms

**Layout Transitions**:
- Shared element transitions between routes (card → detail page)
- Expand/collapse with automatic height animation
- Grid/list view switching with smooth repositioning
- Tab navigation with animated underline

**Advanced Features**:
- SVG line drawing animations
- Path morphing between shapes
- Spring physics for natural bounce
- Orchestrated sequences (staggered reveals)
- Modal dialogs with backdrop blur

**Bundle Optimization**:
- Need 2.3 KB animation library (useAnimate mini)
- Want to reduce Motion from 34 KB to 4.6 KB (LazyMotion)

### ❌ Don't Use Motion When:

**Simple List Animations** → Use `auto-animate` skill instead:
- Todo list add/remove (auto-animate: 3.28 KB vs motion: 34 KB)
- Search results filtering
- Shopping cart items
- Notification toasts
- Basic accordions without gestures

**Static Content**:
- No user interaction or animations needed
- Server-rendered content without client interactivity

**3D Animations** → Use dedicated 3D library:
- Three.js for WebGL
- React Three Fiber for React + Three.js

---

## Installation

```bash
pnpm add motion   # or: npm install motion / yarn add motion
```

**Current Version**: 12.23.24 (verified 2025-11-09). TypeScript support built in.

**Bundle Size**: full `motion` ~34 KB · `LazyMotion` + `m` ~4.6 KB · `useAnimate` mini 2.3 KB · hybrid 17 KB. Requires React 18+/19+.

---

## Core Concepts

### 1. AnimatePresence (Exit Animations)

```tsx
import { AnimatePresence } from "motion/react"

<AnimatePresence>
  {isVisible && (
    <motion.div key="modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      Modal content
    </motion.div>
  )}
</AnimatePresence>
```

**Critical Rules:**
- AnimatePresence **must stay mounted** (don't wrap in conditional)
- All children **must have unique `key` props**
- AnimatePresence **wraps the conditional**, not the other way around

```tsx
// ❌ Wrong - AnimatePresence unmounts with condition
{isVisible && (<AnimatePresence><motion.div>Content</motion.div></AnimatePresence>)}

// ✅ Correct - AnimatePresence stays mounted
<AnimatePresence>{isVisible && <motion.div key="unique">Content</motion.div>}</AnimatePresence>
```

### 2. Layout Animations

- `layout`: Enable FLIP layout animations
- `layoutId`: Connect separate elements for shared transitions
- `layoutScroll`: Fix animations in scrollable containers
- `layoutRoot`: Fix animations in fixed-position elements

```tsx
<motion.div layout>{isExpanded ? <FullContent /> : <Summary />}</motion.div>
```

### 3. Scroll Animations

**Viewport-Triggered (whileInView)**
```tsx
<motion.div initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }}>
  Fades in when 100px from entering viewport
</motion.div>
```

**Scroll-Linked (useScroll)**
```tsx
import { useScroll, useTransform } from "motion/react"
const { scrollYProgress } = useScroll()
const y = useTransform(scrollYProgress, [0, 1], [0, -300])
<motion.div style={{ y }}>Moves up 300px as user scrolls page</motion.div>
```

Uses native ScrollTimeline API when available for hardware acceleration.

---

## Integration Guides

### Vite + React + TypeScript

```bash
pnpm add motion
```
Import: `import { motion } from "motion/react"` — no Vite config needed.

### Next.js App Router

Motion only works in **Client Components**. Create a client wrapper:

```tsx
// src/components/motion-client.tsx
"use client"
import * as motion from "motion/react-client"
export { motion }
```
Or add `"use client"` directly to any component using `motion/react`.

### Tailwind CSS Integration

Let each library do its job: Tailwind for static `className`, Motion for animation props.

```tsx
<motion.button className="bg-blue-600 text-white px-4 py-2 rounded" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
  Tailwind styles + Motion animations
</motion.button>
```

**⚠️ Remove Tailwind `transition-*` classes** — they conflict with Motion (Motion uses inline styles / native animations that override CSS transitions and cause stuttering).

```tsx
// ❌ Wrong
<motion.div className="transition-all duration-300" animate={{ x: 100 }} />
// ✅ Correct
<motion.div animate={{ x: 100 }} />
```

---

## Performance Optimization

### 1. LazyMotion (34 KB → 4.6 KB)

```tsx
import { LazyMotion, domAnimation, m } from "motion/react"
<LazyMotion features={domAnimation}>
  <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Only 4.6 KB!</m.div>
</LazyMotion>
```
Loads features on-demand. Smallest alternative: `useAnimate` mini (2.3 KB).

### 2. Hardware Acceleration

```tsx
<motion.div style={{ willChange: "transform" }} animate={{ x: 100, rotate: 45 }} />
```
Also useful for `opacity`, `backgroundColor`, `clipPath`, `filter`.

### 3. Large Lists → Virtualization

50-100+ animated items freeze the browser. Use `react-window` / `react-virtuoso` / `@tanstack/react-virtual` and only animate visible items.

### 4. `layout` Prop for FLIP

```tsx
<motion.div layout>{isExpanded ? <LargeContent /> : <SmallContent />}</motion.div>
```
Hardware-accelerated via transforms, no reflow/repaint.

---

## Accessibility

```tsx
import { MotionConfig } from "motion/react"
<MotionConfig reducedMotion="user"><App /></MotionConfig>
```
`"user"` respects OS setting (recommended) · `"always"` force instant · `"never"` ignore preference. Works with AnimatePresence (fixed Jan 2023, #1567).

---

## Common Patterns

1. **Modal Dialog** — AnimatePresence with backdrop + dialog exit animations
2. **Accordion** — Animate height with `height: "auto"`
3. **Drag Carousel** — `drag="x"` with `dragConstraints`
4. **Scroll Reveal** — `whileInView` with viewport margin
5. **Parallax Hero** — `useScroll` + `useTransform` for layered effects

---

## Known Issues & Solutions

1. **AnimatePresence exit not working** — AnimatePresence wrapped in conditional or missing `key`. Keep it mounted, wrap the conditional inside, give unique keys.
2. **Large list performance** — virtualize (`react-window`).
3. **Tailwind transitions conflict** — remove `transition-*` classes.
4. **Next.js "use client" missing** — add the directive.
5. **Scrollable container layout** — add `layoutScroll` on the scroll container.
6. **Cloudflare Workers build** — ✅ fixed Dec 2024 (#2918); use motion v12.23.24+ & Wrangler v3+.
7. **Fixed-position layout** — add `layoutRoot`.
8. **layoutId + AnimatePresence unmount** — wrap in `LayoutGroup`.
9. **Reduced motion + AnimatePresence** — ✅ fixed Jan 2023 (#1567).
10. **Reorder in Next.js** — avoid; use alternative drag-to-reorder.

---

## Comparison: Motion vs AutoAnimate

| Aspect | AutoAnimate | Motion |
|--------|-------------|--------|
| Bundle Size | 3.28 KB | 2.3 KB (mini) – 34 KB (full) |
| Use Case | Simple list animations | Complex gestures, scroll, layout |
| Gestures | ❌ | ✅ drag, hover, tap, pan |
| Scroll Animations | ❌ | ✅ parallax, scroll-linked |
| Layout Animations | ❌ | ✅ FLIP, shared elements |
| SVG | ❌ | ✅ path morphing, line drawing |

**Rule of Thumb**: AutoAnimate for 90% (list animations), Motion for 10% (complex interactions).

---

## Official Documentation

- Site: https://motion.dev · React docs: https://motion.dev/docs/react
- GitHub: https://github.com/motiondivision/motion · Examples: https://motion.dev/examples
- npm: https://www.npmjs.com/package/motion

Source: jezweb/claude-skills (motion skill).
