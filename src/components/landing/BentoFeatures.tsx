import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { motionValue } from "motion/react";
// @ts-expect-error — vara ships no types; it is a plain constructor function.
import Vara from "vara";
import varaFont from "vara/fonts/Satisfy/SatisfySL.json?url";
import { IconExternalLink } from "@tabler/icons-react";
import wordmark from "../../assets/landing-logo.svg?raw";
import dashboardArt from "../../assets/landing/bento/dashboard.png";
import dashboardMascot from "../../assets/landing/bento/dashboard-mascot.svg";
import bondsArt from "../../assets/landing/bento/bonds.png";
import efilingArt from "../../assets/landing/bento/efiling.svg";
import ocrArt from "../../assets/landing/bento/ocr.svg";
import lineQr from "../../assets/landing/bento/line-qr.png";
import lineMark from "../../assets/landing/bento/line-icon.png";

/** Where the e-Filing extension lives. Same TODO as YearlySummaryView's copy:
 *  swap in the real listing once the extension is published. */
const CHROME_STORE_URL = "https://chromewebstore.google.com/";

/**
 * The bento assembles itself as the splash card settles onto its slot: each
 * tile slides in from the edge it sits nearest, on its own window of the same
 * scroll. The windows deliberately overlap and run at different lengths — one
 * shared timeline would land all six on the same frame and read as a single
 * block sliding, not as a bento being put together.
 *
 * `start` and `span` are fractions of the splash's scroll; `x`/`y` is where the
 * tile comes from, in px. Nothing moves once assembled: past `start + span`
 * every tile is parked, so the section is still while the reader reads it.
 */
type Entrance = { start: number; span: number; x: number; y: number };
const ENTER: Record<string, Entrance> = {
  dashboard: { start: 0.74, span: 0.16, x: -90, y: 60 },
  efiling: { start: 0.775, span: 0.19, x: 120, y: 40 },
  bonds: { start: 0.81, span: 0.14, x: -70, y: 110 },
  ocr: { start: 0.845, span: 0.17, x: 40, y: 120 },
  line: { start: 0.88, span: 0.12, x: 110, y: 80 },
};

/** Stand-in for the scroll when the entrance is off, so the hook order in
 *  `Tile` never changes. */
const ZERO = motionValue(0);

/** The soft diagonal sheen every coloured tile carries in the design. */
const SHEEN =
  "before:pointer-events-none before:absolute before:-inset-px before:rounded-[inherit] " +
  "before:bg-[radial-gradient(120%_90%_at_18%_-10%,rgba(255,255,255,0.16),rgba(255,255,255,0)_58%)]";

const clamp = (n: number) => Math.min(1, Math.max(0, n));

/** The stretch of the splash's scroll the word is written over. It finishes
 *  well before the card starts folding into the grid at 0.58. */
const DRAW_FROM = 0.06;
const DRAW_TO = 0.46;

/**
 * "Beyond", written rather than printed.
 *
 * Vara ships single-line ("SL") fonts whose glyphs are already pen paths, so
 * there is a stroke to animate at all — an ordinary font gives you outlines,
 * which fill rather than write. But Vara's own animation is a timer, and the
 * hand should follow the reader's scroll, so it is only used to lay the word
 * out: `autoAnimation` is off, `playAll` is never called, and the strokes are
 * dashed off and paid out here against the splash's progress.
 *
 * The hand is Satisfy, not the Momo Signature of the wordmark in Figma.
 */
function BeyondDraw({ progress }: { progress: MotionValue<number> }) {
  const host = useRef<HTMLDivElement>(null);
  /** Every glyph stroke, in writing order, with the slice of the draw it owns.
   *  Slices are proportional to stroke length, so the pen keeps one speed. */
  const strokes = useRef<{ el: SVGPathElement; len: number; from: number; to: number }[]>([]);

  const paint = (v: number) => {
    const t = clamp((v - DRAW_FROM) / (DRAW_TO - DRAW_FROM));
    for (const s of strokes.current) {
      const local = clamp((t - s.from) / (s.to - s.from));
      s.el.style.strokeDashoffset = `${s.len * (1 - local)}`;
    }
  };

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    el.id = "beyond-vara";
    const v = new Vara(
      "#beyond-vara",
      varaFont,
      [{ text: "Beyond", y: 0 }],
      {
        fontSize: 150,
        strokeWidth: 1.4,
        textAlign: "center",
        autoAnimation: false,
        // Vara paints a flat colour; the brand ramp is painted over the top
        // once its paths exist.
        color: "#C4E2FF",
      },
    );
    v.ready(() => {
      const svg = el.querySelector("svg");
      if (!svg) return;
      svg.insertAdjacentHTML(
        "afterbegin",
        `<defs><linearGradient id="beyond-ink" x1="1" y1="0" x2="0" y2="0">` +
          `<stop offset="0.23" stop-color="#C4E2FF"/><stop offset="0.48" stop-color="#8DCBFF"/>` +
          `<stop offset="0.74" stop-color="#FFC998"/></linearGradient></defs>`,
      );
      const paths = [...svg.querySelectorAll("path")] as SVGPathElement[];
      paths.forEach((path) => {
        path.setAttribute("stroke", "url(#beyond-ink)");
        path.setAttribute("stroke-linecap", "round");
        // Vara keeps every glyph at opacity 0 until its own timer draws it.
        // Nothing is going to call that timer, so reveal them here — the dash
        // below is what hides the ink now.
        path.style.opacity = "1";
      });
      // Vara lays the word out in pixels at a fixed size, which would then sit
      // there at full size while the splash card shrinks under it. A viewBox
      // around what it drew makes it scale with the card instead.
      const box = svg.getBBox();
      const pad = 4;
      svg.setAttribute(
        "viewBox",
        `${box.x - pad} ${box.y - pad} ${box.width + pad * 2} ${box.height + pad * 2}`,
      );
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      svg.setAttribute("width", "100%");
      svg.removeAttribute("height");
      svg.style.width = "100%";
      svg.style.height = "auto";
      svg.style.display = "block";
      svg.style.overflow = "visible";

      const lens = paths.map((path) => path.getTotalLength());
      const total = lens.reduce((a, b) => a + b, 0) || 1;
      let run = 0;
      strokes.current = paths.map((path, i) => {
        const from = run / total;
        run += lens[i];
        path.style.transition = "none";
        path.style.strokeDasharray = `${lens[i]}`;
        path.style.strokeDashoffset = `${lens[i]}`;
        return { el: path, len: lens[i], from, to: run / total };
      });
      paint(progress.get());
    });
    return () => {
      strokes.current = [];
      el.replaceChildren();
    };
    // `progress` is a stable MotionValue for the life of the section.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useMotionValueEvent(progress, "change", paint);

  return <div ref={host} className="mt-3 w-full" aria-label="Beyond" role="img" />;
}

function Tile({
  className = "",
  enter,
  sp,
  innerRef,
  children,
}: {
  className?: string;
  /** Where this tile flies in from, and when. Omit to leave it parked. */
  enter?: Entrance;
  /** The splash's scroll progress, 0 → 1. */
  sp?: MotionValue<number>;
  innerRef?: React.Ref<HTMLElement>;
  children: React.ReactNode;
}) {
  const p = enter && sp ? sp : ZERO;
  const a = enter?.start ?? 0;
  const b = a + (enter?.span ?? 1);
  const x = useTransform(p, [a, b], [enter?.x ?? 0, 0]);
  const y = useTransform(p, [a, b], [enter?.y ?? 0, 0]);
  const scale = useTransform(p, [a, b], [0.94, 1]);
  // Opacity is done with before the travel is, so the tile is solid for most
  // of its slide rather than fading the whole way in.
  const fadeIn = (enter?.span ?? 1) * 0.45;
  const opacity = useTransform(p, (v) => Math.min(1, Math.max(0, (v - a) / fadeIn)));
  return (
    <motion.article
      ref={innerRef}
      style={enter && sp ? { x, y, scale, opacity } : undefined}
      className={`relative isolate overflow-hidden rounded-[2rem] p-7 lg:rounded-[2.5rem] lg:p-[clamp(1.75rem,3.4svh,2.5rem)] ${SHEEN} ${className}`}
    >
      {children}
    </motion.article>
  );
}

function Title({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`text-xl leading-snug font-semibold lg:text-2xl ${className}`}>{children}</h3>;
}

function Body({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`mt-4 text-sm leading-relaxed lg:text-xl ${className}`}>{children}</p>;
}

/**
 * The feature bento (Figma 12580:1416). Six tiles on a six-column grid at
 * desktop; a single stacked column on phones, where the wide art would be
 * unreadable anyway.
 */
export default function BentoFeatures() {
  const reduce = useReducedMotion();
  const splashRef = useRef<HTMLDivElement>(null);
  // Two viewports of scroll: the first draws the word, the second shrinks the
  // card down to the size it holds in the grid below.
  const { scrollYProgress: sp } = useScroll({
    target: splashRef,
    offset: ["start start", "end end"],
  });
  const gridRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLElement>(null);
  const { scrollY } = useScroll();

  // Where the splash has to land: the brand tile's real box in page
  // coordinates, so the card arrives exactly on top of it rather than at a
  // guessed percentage of the screen.
  const [slot, setSlot] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  // Where the splash's own scroll begins, so the card can be kept off the
  // screen until then — the layer is fixed, and a fixed card at its start
  // pose covers the whole page above the section.
  const [splashTop, setSplashTop] = useState<number | null>(null);
  const [view, setView] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    if (reduce) return;
    const measure = () => {
      const el = slotRef.current as HTMLElement | null;
      if (!el) return;
      // Layout coordinates, walked up the offset chain: getBoundingClientRect
      // would fold in the entrance scale and hand back a box the card can
      // never land on cleanly.
      let x = 0;
      let y = 0;
      for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) {
        x += n.offsetLeft;
        y += n.offsetTop;
      }
      setSlot({ x, y, w: el.offsetWidth, h: el.offsetHeight });
      let top = 0;
      for (
        let n: HTMLElement | null = splashRef.current;
        n;
        n = n.offsetParent as HTMLElement | null
      )
        top += n.offsetTop;
      setSplashTop(top);
      setView({ w: window.innerWidth, h: window.innerHeight });
    };
    measure();
    // Fonts and art settle after first paint and move the grid under us.
    const ro = new ResizeObserver(measure);
    if (gridRef.current) ro.observe(gridRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [reduce]);

  // Morph: 0 → full screen, 1 → sitting on the slot. Smoothstepped, so it
  // leaves and lands at rest.
  const morph = useTransform(sp, (v) => {
    const t = Math.min(1, Math.max(0, (v - 0.58) / (0.94 - 0.58)));
    return t * t * (3 - 2 * t);
  });
  const pad = view.w >= 1024 ? 32 : 16;
  const fullW = Math.max(0, view.w - pad * 2);
  const fullH = Math.max(0, view.h - pad * 2);
  const mix = (m: number, a: number, b: number) => a + (b - a) * m;
  const cardX = useTransform(morph, (m) => (slot ? mix(m, pad, slot.x) : pad));
  const cardY = useTransform([morph, scrollY] as const, ([m, y]: number[]) =>
    slot ? mix(m, pad, slot.y - y) : pad,
  );
  const cardW = useTransform(morph, (m) => (slot ? mix(m, fullW, slot.w) : fullW));
  const cardH = useTransform(morph, (m) => (slot ? mix(m, fullH, slot.h) : fullH));
  // The contents ride the shrink too, landing on exactly the type sizes the
  // real tile uses: 56px wordmark → 32px, 36px tagline → 20px.
  const cardScale = useTransform(morph, (m) => mix(m, 1, 32 / 56));
  const cardRadius = useTransform(morph, (m) => `${mix(m, pad + 16, 32)}px`);
  // The splash's progress reads 0 both at its first frame and everywhere above
  // it, so the card is gated on the scroll itself: nothing to see until the
  // section's own scroll starts.
  const cardShow = useTransform(scrollY, (y) => (splashTop !== null && y >= splashTop ? 1 : 0));

  return (
    <section id="features" className="scroll-mt-24 bg-[#F0F2F5]">
      {/* ── Splash ───────────────────────────────────────────────────────────
          The brand tile arrives first at full-screen size and shrinks into the
          grid, so the bento reads as unpacking out of it rather than simply
          scrolling in. There is only ever one of it: the tile in the grid
          below holds the space but stays hidden, and this card lands on that
          space and then tracks it — `cardY` subtracts the scroll, so once the
          morph is done the card rides the page exactly as the grid does. That
          is also why the layer is fixed rather than sticky: a sticky one ends
          with its section and would take the card with it. */}
      {!reduce && (
        <div ref={splashRef} className="relative z-10 h-[200svh]">
          <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
            <motion.article
              style={{
                x: cardX,
                y: cardY,
                width: cardW,
                height: cardH,
                borderRadius: cardRadius,
                opacity: cardShow,
              }}
              className={`absolute top-0 left-0 isolate flex items-center justify-center overflow-hidden bg-[#2968A5] text-white ${SHEEN}`}
            >
              <motion.div
                style={{ scale: cardScale }}
                className="flex w-[min(88%,44rem)] flex-col items-center text-center"
              >
                <span
                  className="block h-14 w-auto [&_svg]:h-full [&_svg]:w-auto"
                  style={{ ["--fill-0" as string]: "#FFFFFF" }}
                  aria-label="beond"
                  dangerouslySetInnerHTML={{ __html: wordmark }}
                />
                <span className="mt-4 text-2xl font-light lg:text-4xl">Bring Your Bond</span>
                <BeyondDraw progress={sp} />
              </motion.div>
            </motion.article>
          </div>
        </div>
      )}

      {/* Tile heights follow the viewport, not the type: every lg min-height
          below is a clamp of svh between a floor that keeps the copy readable
          and the ceiling the design drew. A laptop at 900px gets a bento that
          fits on one screen; a tall monitor gets the full-size one.

          The art keeps the design's width percentage and its own ratio; the
          only addition is a `min()` against svh, so a short screen shrinks the
          picture instead of letting it swallow the tile. Do NOT cap it with
          max-height instead: Chrome clamps the height and keeps the width, and
          every picture comes out squashed. */}
      <div
        ref={gridRef}
        className={`relative z-0 mx-auto grid max-w-[1360px] gap-4 px-5 py-20 lg:grid-cols-12 lg:gap-5 lg:px-12 lg:py-[clamp(2.5rem,6svh,7rem)] ${
          reduce ? "" : "-mt-[100svh]"
        }`}
      >
        {/* Interest timeline dashboard — the widest tile, art bleeding off the
            bottom-right corner the way the design shows it. */}
        <Tile
          enter={reduce ? undefined : ENTER.dashboard}
          sp={sp}
          className="bg-[#2968A5] text-white lg:col-span-7 lg:min-h-[clamp(16rem,30svh,26rem)]"
        >
          <Title>แดชบอร์ดไทม์ไลน์ดอกเบี้ย</Title>
          <Body className="max-w-[46ch] text-white/80">
            ติดตามทุกรอบการจ่ายดอกเบี้ยของหุ้นกู้ในพอร์ตได้ครบจบในที่เดียว
            พร้อมระบบแจ้งเตือนเงินเข้าให้คุณอุ่นใจทุกเดือน
          </Body>
          <img
            src={dashboardArt}
            alt=""
            className="pointer-events-none mt-6 w-[130%] max-w-none translate-x-[6%] select-none lg:absolute lg:top-[30%] lg:right-[-8%] lg:mt-0 lg:w-[min(78%,52svh)] lg:translate-x-0"
          />
          <img
            src={dashboardMascot}
            alt=""
            className="pointer-events-none absolute bottom-0 left-[16%] hidden w-[min(20%,14svh)] select-none lg:block"
          />
        </Tile>

        {/* e-Filing — the one light tile, so its CTA reads as the loud one. */}
        <Tile
          enter={reduce ? undefined : ENTER.efiling}
          sp={sp}
          className="bg-white lg:col-span-5 lg:row-span-2"
        >
          <Title className="text-[#3BB732]">E-FILLING อัตโนมัติ</Title>
          <Body className="text-[#3BB732]/80">กรอกข้อมูลรายได้มาตรา 40 (1) ของทั้งปีภายใน 1 คลิ๊ก</Body>
          <a
            href={CHROME_STORE_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#3BB732] px-6 py-2 text-sm font-medium text-white transition hover:brightness-95 lg:text-xl"
          >
            ติดตั้งส่วนเสริม
            <IconExternalLink size={22} />
          </a>
          <img
            src={efilingArt}
            alt=""
            className="pointer-events-none mx-auto mt-8 w-[70%] select-none lg:absolute lg:inset-x-0 lg:bottom-[8%] lg:mt-0 lg:w-[min(52%,34svh)]"
          />
        </Tile>

        {/* Bond coverage. */}
        <Tile
          enter={reduce ? undefined : ENTER.bonds}
          sp={sp}
          className="bg-[#026661] text-white lg:col-span-5 lg:row-span-2 lg:min-h-[clamp(22rem,42svh,34rem)]"
        >
          <Title>เข้าถึงหุ้นกู้มากกว่า 900+ รุ่น</Title>
          <Body className="max-w-[42ch] text-white/80">
            ข้อมูลเชื่อถือได้จากกลต. ไม่ว่าคุณจะลงทุนในหุ้นกู้รุ่นใด เราก็ครอบคลุมหมดทุกรุ่น
          </Body>
          <img
            src={bondsArt}
            alt=""
            className="pointer-events-none mx-auto mt-6 w-[86%] select-none lg:absolute lg:bottom-[6%] lg:left-1/2 lg:mt-0 lg:w-[min(72%,44svh)] lg:-translate-x-1/2"
          />
        </Tile>

        {/* Brand tile. Two columns of a twelve-column grid, starting at the
            sixth — that is the only span that lands dead centre on the page. */}
        {/* The brand tile only holds its place in the grid — the splash card
            above is the one you see, and it comes to rest exactly here. No
            parallax either: a tile that drifts is a tile the card can never
            meet. With motion off there is no splash, so it shows itself. */}
        <Tile
          innerRef={slotRef}
          className={`flex flex-col items-center justify-center bg-[#2968A5] text-center text-white lg:col-span-2 lg:col-start-6 ${
            reduce ? "" : "invisible"
          }`}
        >
          <span
            className="block h-8 w-auto [&_svg]:h-full [&_svg]:w-auto"
            style={{ ["--fill-0" as string]: "#FFFFFF" }}
            aria-label="beond"
            dangerouslySetInnerHTML={{ __html: wordmark }}
          />
          <span className="mt-2 text-base font-light lg:text-xl">Bring Your Bond</span>
          <span className="bg-[linear-gradient(270deg,#C4E2FF_23%,#8DCBFF_48%,#FFC998_74%)] bg-clip-text font-momo text-2xl font-normal text-transparent lg:text-3xl">
            Beyond
          </span>
        </Tile>

        {/* Slip OCR. */}
        <Tile
          enter={reduce ? undefined : ENTER.ocr}
          sp={sp}
          className="bg-[#84A3CF] text-white lg:col-span-5 lg:col-start-6 lg:min-h-[clamp(12rem,22svh,19rem)]"
        >
          <Title>OCR ใบสลิปดอกเบี้ยหุ้นกู้</Title>
          <Body className="max-w-[34ch] text-white/80">
            เพียงสแกนและยืนยันความถูกต้อง แค่นี้ก็พร้อมสำหรับใช้ยื่นภาษีแล้ว
          </Body>
          <img
            src={ocrArt}
            alt=""
            className="pointer-events-none mt-6 ml-auto w-[60%] select-none lg:absolute lg:right-[4%] lg:bottom-[6%] lg:mt-0 lg:w-[min(38%,26svh)]"
          />
        </Tile>

        {/* Add the OA as a friend. */}
        <Tile
          enter={reduce ? undefined : ENTER.line}
          sp={sp}
          className="bg-[#06C755] text-white lg:col-span-2"
        >
          <div className="flex items-center gap-2">
            <img src={lineMark} alt="" className="size-8 rounded-lg" />
            {/* One line at every width — the tile is only a column wide. */}
            <span className="text-base font-semibold whitespace-nowrap lg:text-lg">มาเป็นเพื่อนกันเถอะ</span>
          </div>
          <img
            src={lineQr}
            alt="LINE QR สำหรับเพิ่มเพื่อน beond"
            className="mx-auto mt-6 w-[min(9.75rem,22svh)] rounded-2xl bg-white p-2"
          />
        </Tile>
      </div>
    </section>
  );
}
