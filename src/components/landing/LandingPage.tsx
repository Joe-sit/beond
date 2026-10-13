import { lazy, Suspense, useRef, useState } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { IconArrowUp, IconChevronDown } from "@tabler/icons-react";
import wordmark from "../../assets/landing-logo.svg?raw";
import lineIcon from "../../assets/landing-line-icon.png";
import clouds from "../../assets/landing/hero-clouds.svg";
import dashboardWide from "../../assets/landing/story/dashboard-wide.png";
import dashboardPhone from "../../assets/landing/story/dashboard-phone.png";
import SlipsIntoFolder from "./SlipsIntoFolder";
import { useIsDesktop } from "../../lib/useIsDesktop";
import BentoFeatures from "./BentoFeatures";
import EfilingAct from "./EfilingAct";

// The 3D hero pulls in three + r3f — code-split so the first paint (headline
// and clouds) never waits on the renderer.
const HeroScreen3D = lazy(() => import("./HeroScreen3D"));
// The jar carries its own renderer, so it is split out too and mounted only for
// the scene that shows it.
const RefundJar = lazy(() => import("./RefundJar"));

interface Props {
  onLogin: () => void;
  /** Shown as a banner when the visitor landed here from an expired session. */
  notice?: string;
}

/** The scroll-told story: one headline + one screen per beat (Figma 1652:4779). */
/** Where support mail lands, and where the extension will be listed. */
const SUPPORT_EMAIL = "beond.support@gmail.com";
const CHROME_STORE_URL = "https://chromewebstore.google.com/";

/** Entrance for the hero's text: up and in, on a long ease-out. */
const RISE = {
  hidden: { opacity: 0, y: 26 },
  shown: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const SCENES = [
  {
    key: "record",
    title: "ไม่ต้องจดเองอีกต่อไป",
    body: "ถ่ายใบ 50 ทวิ ส่งเข้าแชท beond อ่านเลขให้ครบทุกช่อง แล้วบันทึกเข้าพอร์ตให้ทันที",
    align: "left",
    art: null,
  },
  {
    key: "verify",
    title: "ตรวจสอบให้ทุกใบ",
    body: "เทียบเลขผู้เสียภาษี 13 หลักกับกรมพัฒนาธุรกิจการค้า ก่อนเก็บเข้าเครดิตภาษีของคุณ",
    align: "left",
    art: null,
  },
  {
    key: "collect",
    title: "สะสมสลิปครบทั้งปี",
    body: "รู้ทันทีว่าปีนี้ยังขาดใบไหน beond เตือนทุกสัปดาห์จนกว่าจะครบทุกงวด",
    align: "center",
    art: "dashboard",
  },
  {
    key: "refund",
    title: "ยื่นขอภาษีคืน",
    body: "สรุปยอดภาษีที่ถูกหักไว้ทั้งปี พร้อมกรอกลง e-Filing ได้เลยตอนต้นปีถัดไป",
    align: "center",
    art: "refund",
  },
] as const;

/**
 * How many viewports of scroll each scene gets.
 *
 * Equal spans meant one flick of the wheel crossed a whole beat, and the
 * closing scene — which plays two animations in sequence — was gone before
 * either finished. Scroll is the story's clock, so the scenes that have more to
 * show are given more of it.
 */
const SCENE_SCROLL = [1.4, 1.4, 1.6, 3.2] as const;
const STORY_VH = SCENE_SCROLL.reduce((sum, n) => sum + n, 0);

/** Where a scene starts and ends, as a fraction of the story's own scroll. */
function sceneBounds(index: number): [number, number] {
  let start = 0;
  for (let i = 0; i < index; i++) start += SCENE_SCROLL[i];
  return [start / STORY_VH, (start + SCENE_SCROLL[index]) / STORY_VH];
}

/**
 * The story's scroll progress re-expressed as if every scene had equal scroll:
 * scene n spans [n/4, (n+1)/4]. The 3D device's poses (STORY_POSE) and the chat
 * on its screen are keyed to scene boundaries at even quarters; feeding them
 * the raw, weighted progress made the device linger into scene three and sit
 * over the dashboard art.
 */
function evenSceneProgress(v: number): number {
  const n = SCENE_SCROLL.length;
  for (let i = 0; i < n; i++) {
    const [start, end] = sceneBounds(i);
    if (v <= end || i === n - 1) {
      const local = Math.min(1, Math.max(0, (v - start) / (end - start)));
      return (i + local) / n;
    }
  }
  return 1;
}

/**
 * Public landing page (Figma 1446:5601 + storyboard 1652:4779).
 *
 * Three movements: a hero whose product screen lifts out of a 3D tilt as the
 * page starts moving, a sticky scroll-told story where the headline and the
 * screen change together, and the dashboard reveal that hands off to the CTA.
 * Every scroll-driven transform is skipped under `prefers-reduced-motion` —
 * the same content is then simply stacked.
 */
export default function LandingPage({ onLogin, notice }: Props) {
  const reduce = useReducedMotion();
  const heroRef = useRef<HTMLElement>(null);
  const storyRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Hero: 0 at load, 1 once the hero has scrolled fully past the top.
  const { scrollYProgress: heroP } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroEase = useSpring(heroP, { stiffness: 120, damping: 30, mass: 0.4 });
  // The headline sits *behind* the product window and defocuses as the window
  // rises over it (droppable.app's move), rather than scrolling away first.
  const heroTextY = useTransform(heroEase, [0, 1], ["0%", "-18%"]);
  const heroTextFade = useTransform(heroEase, [0, 0.55], [1, 0.4]);
  const heroTextBlur = useTransform(
    heroEase,
    [0, 0.3],
    ["blur(0px)", "blur(10px)"],
  );
  // Clouds sit furthest back, so they answer the scroll least: they sink and
  // spread while the device and the copy travel the full distance over them.
  const cloudY = useTransform(heroEase, [0, 1], ["0%", "26%"]);
  const cloudScale = useTransform(heroEase, [0, 1], [1, 1.18]);
  // Nav hides on the way down and comes back the moment the page moves up.
  // `hidden` only flips on a direction change, so this is a handful of state
  // updates per gesture, not one per scroll event.
  const { scrollY } = useScroll();
  const [navHidden, setNavHidden] = useState(false);
  // Back-to-top only earns its place once the page is a screen deep.
  const [atTop, setAtTop] = useState(true);
  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    if (y > prev && y > 140) setNavHidden(true);
    else if (y < prev) setNavHidden(false);
    setAtTop(y < window.innerHeight * 0.9);
  });

  // Story: scenes get SCENE_SCROLL viewports each.
  const { scrollYProgress: storyP } = useScroll({
    target: storyRef,
    offset: ["start start", "end end"],
  });
  // The same progress in even quarters, for everything keyed to scene
  // boundaries rather than to raw scroll — see evenSceneProgress.
  const storyEven = useTransform(storyP, evenSceneProgress);
  // The stage's last viewport of scroll, after the story's progress has
  // already saturated: the device rides this out of frame.
  const { scrollYProgress: stageExit } = useScroll({
    target: stageRef,
    offset: ["end end", "end start"],
  });
  // The story's sky arrives as a capsule and widens into a full-bleed
  // background over the first stretch of its scroll.
  const skyWidth = useTransform(storyP, [0, 0.12], ["34%", "100%"]);
  const skyRadiusPx = useTransform(storyP, [0, 0.12], [280, 0]);
  const skyRadius = useMotionTemplate`${skyRadiusPx}px ${skyRadiusPx}px 0px 0px`;

  // The outline headline follows the solid copy, but has to be gone by the time
  // the story starts — it sits in the shared stage, which outlives the hero.
  const strokeFade = useTransform(heroEase, [0, 0.55, 0.8], [1, 0.4, 0]);

  // The chat on the device's screen. It opens during the hero's second act as
  // the slips fly in, then walks the conversation across the story — one
  // scroll, one thread. The story half is stretched so each beat lands on the
  // card that proves it: "ตรวจสอบให้ทุกใบ" while the DBD refusal is on screen,
  // and the rest of the thread over the scenes the device has already left.
  const chat = useTransform([heroP, storyEven] as const, ([h, s]: number[]) => {
    if (s <= 0) return h * 0.1;
    return s < 0.5 ? 0.1 + (s / 0.5) * 0.3 : 0.4 + ((s - 0.5) / 0.5) * 0.6;
  });

  return (
    // `overflow-x-clip`, never `hidden`: hidden makes this a scroll container,
    // which silently kills every `position: sticky` inside it.
    <div className="min-h-dvh overflow-x-clip bg-[#F0F2F5] font-kanit">
      {notice && (
        <p className="bg-[#43507F] px-4 py-2 text-center text-sm text-white">
          {notice}
        </p>
      )}

      {/* Floating nav pill — the same shape at every width. */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-4 pt-4 lg:px-10 lg:pt-6">
        <motion.nav
          initial={reduce ? false : { opacity: 0, y: -18 }}
          animate={{ opacity: navHidden ? 0 : 1, y: navHidden ? -110 : 0 }}
          transition={{
            duration: navHidden ? 0.28 : 0.45,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="pointer-events-auto mx-auto flex max-w-[1360px] items-center justify-between rounded-full bg-white px-5 py-3 lg:px-7 lg:py-4"
        >
          {/* The wordmark paints itself with `--fill-0`, which defaults to white
              — invisible on the white pill. Inline the SVG so the variable can
              be set. */}
          <span
            className="block h-5 w-auto shrink-0 lg:h-6 [&_svg]:h-full [&_svg]:w-auto"
            style={{ ["--fill-0" as string]: "#43507F" }}
            aria-label="beond"
            dangerouslySetInnerHTML={{ __html: wordmark }}
          />
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-[#43507F] transition hover:bg-black/5">
              TH <IconChevronDown size={16} />
            </button>
            <button
              onClick={onLogin}
              className="flex items-center gap-2 rounded-full bg-[#06C755] px-5 py-2.5 text-sm font-medium text-white transition hover:brightness-95"
            >
              <img src={lineIcon} alt="" className="size-5 rounded-md" />
              เข้าสู่ระบบ
            </button>
          </div>
        </motion.nav>
      </header>

      {/* ── Hero + story share one 3D device ─────────────────────────────
          The canvas lives here rather than inside the hero, so the same
          renderer carries through both sections and the device simply keeps
          moving. A zero-height sticky layer holds it: sticky elements take up
          flow space, and a full-height one would push the sections down. */}
      <div ref={stageRef} className="relative isolate">
        <div className="pointer-events-none sticky top-0 z-10 h-0">
          {/* The layer stays pinned while the bento scrolls up underneath, so
              the device drops itself out of frame at the end of the story —
              see STORY_POSE's exit. Doing it in 3D rather than with a DOM
              opacity keeps it on the render loop the rest of the scene uses. */}
          <div className="relative h-svh">
            <div className="absolute inset-x-0 top-[8svh] -bottom-[22svh] mx-auto max-w-[900px]">
              {/* No fallback image: the old flat screenshot it used to show is a
                  different, earlier design, so it flashed one product and then
                  swapped it for another. Nothing is better — the sky behind it
                  is already the finished background, and the device arrives
                  into it. */}
              <Suspense fallback={null}>
                <HeroScreen3D
                  progress={heroEase}
                  collect={heroP}
                  story={storyEven}
                  exit={stageExit}
                  chat={chat}
                  reduce={!!reduce}
                />
              </Suspense>
            </div>
          </div>
        </div>

        {/* The outline copy of the headline rides above the device, so it lives
            in the shared stage too: the canvas layer paints over the whole hero
            section, and anything left inside it would be hidden behind the
            device rather than stroked across it. */}
        <div className="pointer-events-none sticky top-0 z-20 h-0">
          <div className="relative h-svh overflow-hidden px-5 lg:px-12">
            {/* The same headline again, above the device and drawn as an outline.
            Where the device covers the solid copy underneath, this is what
            shows — the letters read as a stroke across the screen. Kept in
            lockstep with the copy below by sharing its transforms. */}
            <motion.div
              aria-hidden
              style={
                reduce
                  ? undefined
                  : { y: heroTextY, opacity: strokeFade, filter: heroTextBlur }
              }
              className="pointer-events-none absolute inset-x-0 top-[14svh] px-5 lg:top-[24svh] lg:px-12"
            >
              <motion.h1
                initial={reduce ? false : { opacity: 0, y: 26 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.75,
                  delay: 0.15,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="mx-auto w-fit text-center text-[clamp(1.9rem,8.4vw,8rem)] leading-[1.05] font-medium whitespace-nowrap text-transparent"
                style={{ WebkitTextStroke: "1.5px rgba(255,255,255,0.9)" }}
              >
                เพิ่มผลตอบแทนหุ้นกู้
              </motion.h1>
            </motion.div>
          </div>
        </div>

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        {/* Four viewports tall. The first buys the device its turn to camera;
          the rest is act two, where the slips fly in — at three it went by in
          a single flick. */}
        <section
          ref={heroRef}
          className="relative z-0 min-h-[400svh] bg-[linear-gradient(180deg,#779BC6_0%,#9CB6D6_55%,#F0F2F5_100%)]"
        >
          <div className="sticky top-0 h-svh overflow-hidden px-5 lg:px-12">
            {/* Headline sits high and the device rises over its lower half — the
              two overlap on purpose, as in the reference. The supporting lines
              hang off the headline's own edges, so the block is shrink-wrapped
              to the headline rather than to the page. */}
            <motion.div
              style={
                reduce
                  ? undefined
                  : {
                      y: heroTextY,
                      opacity: heroTextFade,
                      filter: heroTextBlur,
                    }
              }
              // Higher on a phone: the device rises from the middle of a narrow
              // screen, and at desktop height the copy sat right under it.
              className="pointer-events-none absolute inset-x-0 top-[14svh] z-0 px-5 lg:top-[24svh] lg:px-12"
            >
              {/* The scroll drives the wrapper above; the entrance animates this
                inner block, so the two never write to the same transform. */}
              <motion.div
                initial={reduce ? false : "hidden"}
                animate="shown"
                variants={{
                  hidden: {},
                  shown: {
                    transition: { staggerChildren: 0.12, delayChildren: 0.15 },
                  },
                }}
                className="mx-auto w-fit"
              >
                <motion.h1
                  variants={RISE}
                  className="text-center text-[clamp(1.9rem,8.4vw,8rem)] leading-[1.05] font-medium whitespace-nowrap text-white"
                >
                  เพิ่มผลตอบแทนหุ้นกู้
                </motion.h1>
                <motion.div
                  variants={RISE}
                  className="mt-4 flex flex-col items-center gap-2 text-center lg:mt-8 lg:flex-row lg:items-start lg:justify-between lg:gap-6 lg:text-left"
                >
                  <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-base leading-snug font-medium text-white lg:max-w-[15ch] lg:justify-start lg:gap-x-3 lg:gap-y-2 lg:text-2xl">
                    ส่งสลิปผ่าน LINE
                    <img
                      src={lineIcon}
                      alt=""
                      className="size-6 rounded-lg lg:size-10 lg:rounded-xl"
                    />
                    <span className="lg:w-full">และยื่นขอภาษีคืนปีหน้า</span>
                  </p>
                  {/* Desktop only: on a phone the device rises into this line,
                      and the headline plus the LINE line already say it. */}
                  <p className="hidden max-w-[22ch] text-xs leading-relaxed font-light text-white/90 lg:block lg:text-right lg:text-lg">
                    แพลตฟอร์มสำหรับบริหารจัดการ
                    <br />
                    พอร์ตหุ้นกู้และเครดิตภาษี
                  </p>
                </motion.div>
              </motion.div>
            </motion.div>

            {/* Cloud band behind everything, parallaxing against the scroll. */}
            <motion.img
              src={clouds}
              alt=""
              aria-hidden
              style={reduce ? undefined : { y: cloudY, scale: cloudScale }}
              className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 w-full origin-bottom select-none"
            />
          </div>
        </section>

        {/* ── Scroll-told story (Figma 12583:2117) ─────────────────────────
            The sky carries on from the hero and only lands on the page grey at
            the very end, so the whole scroll reads as one shot. Headlines sit
            at the top — left while the 3D device holds the right half, centred
            once the flat dashboard art takes over. */}
        <div
          ref={storyRef}
          className="relative z-0"
          style={{ height: `${STORY_VH * 100}vh` }}
        >
          {/* The sky itself: a capsule that grows into the section's
              background, rather than a colour that simply starts. */}
          <motion.div
            aria-hidden
            style={
              reduce ? undefined : { width: skyWidth, borderRadius: skyRadius }
            }
            // Holds its blue until the last stretch: the closing scene now takes
            // the final ~40% of the scroll, and with the fade starting at 62%
            // its white headline ended up on near-white.
            className="absolute inset-y-0 left-1/2 -translate-x-1/2 bg-[linear-gradient(180deg,#8FAED2_0%,#9CB6D6_86%,#F0F2F5_100%)] max-lg:w-full"
          />
          <div className="relative sticky top-0 h-svh overflow-hidden">
            {/* Art for the scenes the device has handed over to. */}
            {SCENES.map((s, n) => (
              <SceneArt
                key={s.key}
                scene={s}
                index={n}
                total={SCENES.length}
                p={storyP}
                reduce={!!reduce}
              />
            ))}
            <div className="absolute inset-x-0 top-[12svh] px-5 lg:px-16">
              <div className="relative mx-auto min-h-[11rem] w-full max-w-[1240px] lg:min-h-[13rem]">
                {SCENES.map((s, n) => (
                  <SceneText
                    key={s.key}
                    scene={s}
                    index={n}
                    total={SCENES.length}
                    p={storyP}
                    reduce={!!reduce}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── e-Filing autofill ────────────────────────────────────────────── */}
      <EfilingAct />

      {/* ── Feature bento ────────────────────────────────────────────────── */}
      <BentoFeatures />

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      {/* Navy, not white: the section opens on the page grey and only reaches
          the sky blue at its foot, so white copy sat on near-white where the
          heading is. "งวดนี้" is held together so a narrow screen can't leave
          "นี้" alone on the second line. */}
      <section className="bg-[linear-gradient(180deg,#F0F2F5_0%,#779BC6_100%)] px-5 py-24 text-center lg:py-32">
        <h2 className="text-[clamp(2rem,4.6vw,3.75rem)] leading-tight font-medium text-balance text-[#43507F]">
          เริ่มเก็บ<span className="whitespace-nowrap">ภาษีคืน</span>ตั้งแต่<span className="whitespace-nowrap">งวดนี้</span>
        </h2>
        <p className="mx-auto mt-4 max-w-[52ch] text-base leading-relaxed text-[#43507F]/75 lg:text-xl">
          เข้าสู่ระบบด้วย LINE ใช้เวลาไม่ถึงหนึ่งนาที แล้วส่งสลิปใบแรกได้ทันที
        </p>
        <button
          onClick={onLogin}
          className="mt-10 inline-flex items-center gap-3 rounded-full bg-[#06C755] px-10 py-4 text-base font-medium text-white transition hover:brightness-95"
        >
          <img src={lineIcon} alt="" className="size-6 rounded-lg" />
          เข้าสู่ระบบด้วย LINE
        </button>
      </section>

      {/* Back to top. The landing is a long scroll and the nav hides on the
          way down, so this is the only way back up without a gesture. */}
      <motion.button
        type="button"
        onClick={() =>
          window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })
        }
        initial={false}
        animate={{
          opacity: atTop ? 0 : 1,
          y: atTop ? 16 : 0,
          pointerEvents: atTop ? "none" : "auto",
        }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        aria-label="กลับขึ้นด้านบน"
        className="fixed right-5 bottom-5 z-50 flex size-12 items-center justify-center rounded-full bg-white text-[#2968A5] shadow-[0_6px_24px_rgba(30,52,89,0.18)] transition hover:bg-black/5 lg:right-10 lg:bottom-10"
      >
        <IconArrowUp size={22} />
      </motion.button>

      {/* ── Footer (Figma 12580:1800) ────────────────────────────────────── */}
      <footer className="bg-white px-5 pt-14 pb-8 lg:px-12">
        <div className="mx-auto max-w-[1360px]">
          <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between">
            {/* The wordmark is the design's anchor here — oversized, cropped by
                nothing, carrying the whole left half. */}
            <span
              className="block h-20 w-auto shrink-0 lg:h-36 [&_svg]:h-full [&_svg]:w-auto"
              style={{ ["--fill-0" as string]: "#2968A5" }}
              aria-label="beond"
              dangerouslySetInnerHTML={{ __html: wordmark }}
            />

            <nav className="flex flex-wrap gap-x-10 gap-y-8 lg:gap-x-14">
              <FooterColumn title="บริการ">
                <FooterLink href="#features">
                  แดชบอร์ดไทม์ไลน์ดอกเบี้ย
                </FooterLink>
                <FooterLink href="#features">OCR ใบ 50 ทวิ</FooterLink>
                <FooterLink href={CHROME_STORE_URL} external>
                  ส่วนเสริม e-Filing
                </FooterLink>
              </FooterColumn>
              <FooterColumn title="ความรู้">
                <FooterLink href="/learn">ความรู้ภาษีหุ้นกู้</FooterLink>
                <FooterLink href="/learn/wht-15">ภาษีหัก ณ ที่จ่าย 15% คืออะไร</FooterLink>
                <FooterLink href="/learn/file-pnd90">วิธียื่น ภ.ง.ด.90</FooterLink>
              </FooterColumn>
              <FooterColumn title="ช่วยเหลือ">
                <FooterLink
                  href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("แจ้งปัญหาการใช้งาน beond")}`}
                >
                  แจ้งปัญหาการใช้งาน
                </FooterLink>
                <FooterLink href="/privacy">นโยบายความเป็นส่วนตัว</FooterLink>
              </FooterColumn>
              <FooterColumn title="ติดต่อ">
                <FooterLink href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </FooterLink>
              </FooterColumn>
            </nav>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-[#2968A5]/60 lg:justify-end">
            <span>Copyright © 2026 beond. All rights reserved.</span>
            <a href="/privacy" className="transition hover:text-[#2968A5]">
              นโยบายความเป็นส่วนตัว
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * A scene's own slice of the story's scroll range, as the four keyframe stops
 * [enter, held, still held, gone]. Scenes overlap so one fades out as the next
 * fades in. Every stop is clamped to [0,1] and kept non-decreasing — motion
 * hands these straight to WAAPI as keyframe offsets, which rejects anything
 * outside that range.
 */
function slice(index: number, total: number): [number, number, number, number] {
  const [start, end] = sceneBounds(index);
  const span = end - start;
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  // The last scene never fades: progress hits 1 while the sticky stage is
  // still pinned, and the block's final viewport then scrolls that frame away
  // on its own. Fading it there would leave a blank screen instead.
  if (index === total - 1) {
    return [clamp(start + span * 0.02), clamp(start + span * 0.16), 0.99, 1];
  }
  // Kept inside the scene's own span: a wider overlap left two headlines
  // legible on top of each other mid-transition.
  const stops: [number, number, number, number] = [
    clamp(start + span * 0.02),
    clamp(start + span * 0.16),
    clamp(start + span * 0.8),
    clamp(start + span * 0.95),
  ];
  // A clamped stop can land on top of the one before it; nudge it forward so
  // the range stays strictly increasing.
  for (let n = 1; n < stops.length; n++) {
    if (stops[n] <= stops[n - 1]) stops[n] = Math.min(1, stops[n - 1] + 0.0001);
  }
  return stops;
}

function SceneText({
  scene,
  index,
  total,
  p,
  reduce,
}: {
  scene: (typeof SCENES)[number];
  index: number;
  total: number;
  p: MotionValue<number>;
  reduce: boolean;
}) {
  const [a, b, c, d] = slice(index, total);
  // The last scene holds instead of fading out — see slice().
  const last = index === total - 1;
  const opacity = useTransform(p, [a, b, c, d], [0, 1, 1, last ? 1 : 0]);
  const y = useTransform(p, [a, b, c, d], [40, 0, 0, last ? 0 : -40]);
  const centred = scene.align === "center";
  return (
    <motion.div
      style={reduce ? undefined : { opacity, y }}
      className={`inset-x-0 top-0 ${
        centred ? "text-center" : "lg:w-[52%]"
      } ${reduce ? "mb-12" : "absolute"}`}
    >
      <h2 className="text-[clamp(2rem,4.4vw,4rem)] leading-tight font-medium text-white">
        {scene.title}
      </h2>
      <p
        className={`mt-4 max-w-[46ch] text-base leading-relaxed text-white/80 lg:text-xl ${
          centred ? "mx-auto" : ""
        }`}
      >
        {scene.body}
      </p>
    </motion.div>
  );
}

/**
 * Art for the scenes the 3D device has handed over to: the dashboard composite,
 * and the closing pair of animations, both anchored to the bottom of the stage
 * the way the storyboard frames them.
 */
function SceneArt({
  scene,
  index,
  total,
  p,
  reduce,
}: {
  scene: (typeof SCENES)[number];
  index: number;
  total: number;
  p: MotionValue<number>;
  reduce: boolean;
}) {
  const [a, b, c, d] = slice(index, total);
  const last = index === total - 1;
  const opacity = useTransform(p, [a, b, c, d], [0, 1, 1, last ? 1 : 0]);
  const y = useTransform(p, [a, b, c, d], [60, 0, 0, last ? 0 : -30]);
  // The closing scene plays in two beats, handed over on the scroll that holds
  // it: the folder fills, then the jar takes the stage.
  const beat = useTransform(p, [b, c], [0, 1]);
  const isDesktop = useIsDesktop();
  const folderFade = useTransform(beat, [0, 0.42, 0.56], [1, 1, 0]);
  const jarFade = useTransform(beat, [0.46, 0.62], [0, 1]);
  // The jar holds a WebGL context and a physics world, and the landing already
  // runs a renderer for the 3D device — so it exists only around its own beat,
  // mounted early enough to have dropped a coin or two by the time it fades in.
  const [jarLive, setJarLive] = useState(false);
  useMotionValueEvent(beat, "change", (v) => setJarLive(v > 0.28 && v < 1.3));
  if (!scene.art) return null;
  return (
    <motion.div
      style={reduce ? undefined : { opacity, y }}
      className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-5 lg:px-16"
    >
      {scene.art === "dashboard" ? (
        <div className="relative w-full max-w-[1040px]">
          <img
            src={dashboardWide}
            alt=""
            className="w-full rounded-t-3xl border border-black/10 select-none"
          />
          {/* The phone overlaps the desktop shot's lower-left corner. */}
          <img
            src={dashboardPhone}
            alt=""
            className="absolute bottom-0 left-0 hidden w-[26%] rounded-3xl border border-black/10 shadow-[0_4px_24px_rgba(0,0,0,0.12)] select-none lg:block"
          />
        </div>
      ) : (
        // The last beat, played rather than illustrated: the year's slips file
        // themselves and what was withheld lands in the jar. Both are the
        // dashboard's own animations, the same ones a user meets after a slip
        // is confirmed over LINE.
        // Two beats, one stage. The slips are filed first; only once the year
        // is in the folder does what it was withheld for arrive in the jar.
        // Side by side they were one picture and read as neither.
        <div className="relative h-[46svh] w-full max-w-[560px] pb-[6svh] lg:h-[52svh]">
          <motion.div className="absolute inset-0" style={reduce ? { opacity: 0 } : { opacity: folderFade }}>
            {/* Folder3D sizes in pixels; at the desktop scale it overran a
                phone's width and the slips were cut off at both edges. */}
            <SlipsIntoFolder scale={isDesktop ? 0.62 : 0.46} />
          </motion.div>
          <motion.div className="absolute inset-0" style={reduce ? undefined : { opacity: jarFade }}>
            {/* Nothing to fall back to: an empty box for a moment reads as the
                jar arriving, which is what it is. */}
            <Suspense fallback={null}>{jarLive && <RefundJar />}</Suspense>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

/** One footer column: a heading over its links. */
function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-semibold text-[#2968A5]">{title}</h3>
      {children}
    </div>
  );
}

function FooterLink({
  href,
  external,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className="text-base text-[#2968A5]/80 transition hover:text-[#2968A5]"
    >
      {children}
    </a>
  );
}
