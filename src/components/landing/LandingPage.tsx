import { lazy, Suspense, useRef, useState } from "react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { IconChevronDown } from "@tabler/icons-react";
import wordmark from "../../assets/landing-logo.svg?raw";
import lineIcon from "../../assets/landing-line-icon.png";
import clouds from "../../assets/landing/hero-clouds.svg";
import sceneChat from "../../assets/landing/scene-check-phone.png";
import sceneCollect from "../../assets/landing/scene-collect-phone.png";
import scenePhone from "../../assets/landing/scene-phone-2.png";
import sceneRefund from "../../assets/landing/scene-refund.png";
import lineWindow from "../../assets/landing/line-window-flat.png";

// The 3D hero pulls in three + r3f — code-split so the first paint (headline,
// clouds, the flat screenshot fallback) never waits on the renderer.
const HeroScreen3D = lazy(() => import("./HeroScreen3D"));

interface Props {
  onLogin: () => void;
  /** Shown as a banner when the visitor landed here from an expired session. */
  notice?: string;
}

/** The scroll-told story: one headline + one screen per beat (Figma 1652:4779). */
/** Entrance for the hero's text: up and in, on a long ease-out. */
const RISE = {
  hidden: { opacity: 0, y: 26 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] as const } },
};

const SCENES = [
  {
    key: "record",
    title: "ไม่ต้องจดเองอีกต่อไป",
    body: "ถ่ายใบ 50 ทวิ ส่งเข้าแชท beond อ่านเลขให้ครบทุกช่อง แล้วบันทึกเข้าพอร์ตให้ทันที",
    art: sceneChat,
    portrait: true,
  },
  {
    key: "verify",
    title: "ตรวจสอบให้ทุกใบ",
    body: "เทียบเลขผู้เสียภาษี 13 หลักกับกรมพัฒนาธุรกิจการค้า ก่อนเก็บเข้าเครดิตภาษีของคุณ",
    art: scenePhone,
    portrait: true,
  },
  {
    key: "collect",
    title: "สะสมสลิปครบทั้งปี",
    body: "รู้ทันทีว่าปีนี้ยังขาดใบไหน beond เตือนทุกสัปดาห์จนกว่าจะครบทุกงวด",
    art: sceneCollect,
    portrait: true,
  },
  {
    key: "refund",
    title: "ยื่นขอภาษีคืน",
    body: "สรุปยอดภาษีที่ถูกหักไว้ทั้งปี พร้อมกรอกลง e-Filing ได้เลยตอนต้นปีถัดไป",
    art: sceneRefund,
    portrait: false,
  },
] as const;

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

  // Hero: 0 at load, 1 once the hero has scrolled fully past the top.
  const { scrollYProgress: heroP } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroEase = useSpring(heroP, { stiffness: 120, damping: 30, mass: 0.4 });
  // The headline sits *behind* the product window and defocuses as the window
  // rises over it (droppable.app's move), rather than scrolling away first.
  const heroTextY = useTransform(heroEase, [0, 1], ["0%", "-18%"]);
  const heroTextFade = useTransform(heroEase, [0, 0.55], [1, 0.4]);
  const heroTextBlur = useTransform(heroEase, [0, 0.3], ["blur(0px)", "blur(10px)"]);
  // Act two's caption, in while the slips are flying into the window.
  const collectFade = useTransform(heroEase, [0.34, 0.44, 0.82, 0.9], [0, 1, 1, 0]);
  const collectY = useTransform(heroEase, [0.34, 0.44], [30, 0]);

  // Nav hides on the way down and comes back the moment the page moves up.
  // `hidden` only flips on a direction change, so this is a handful of state
  // updates per gesture, not one per scroll event.
  const { scrollY } = useScroll();
  const [navHidden, setNavHidden] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    if (y > prev && y > 140) setNavHidden(true);
    else if (y < prev) setNavHidden(false);
  });

  // Story: one full viewport of scroll per scene.
  const { scrollYProgress: storyP } = useScroll({ target: storyRef, offset: ["start start", "end end"] });

  return (
    // `overflow-x-clip`, never `hidden`: hidden makes this a scroll container,
    // which silently kills every `position: sticky` inside it.
    <div className="min-h-dvh overflow-x-clip bg-[#F0F2F5] font-kanit">
      {notice && (
        <p className="bg-[#43507F] px-4 py-2 text-center text-sm text-white">{notice}</p>
      )}

      {/* Floating nav pill — the same shape at every width. */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-4 pt-4 lg:px-10 lg:pt-6">
        <motion.nav
          initial={reduce ? false : { opacity: 0, y: -18 }}
          animate={{ opacity: navHidden ? 0 : 1, y: navHidden ? -110 : 0 }}
          transition={{ duration: navHidden ? 0.28 : 0.45, ease: [0.22, 1, 0.36, 1] }}
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

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      {/* Two viewports tall: the stage inside is pinned for the first one, so
          the window has room to rise over the headline before the page moves
          on to the story. */}
      <section
        ref={heroRef}
        className="relative isolate min-h-[300svh] bg-[linear-gradient(180deg,#779BC6_0%,#9CB6D6_55%,#F0F2F5_100%)]"
      >
        <div className="sticky top-0 h-svh overflow-hidden px-5 lg:px-12">
          {/* Headline sits high and the device rises over its lower half — the
              two overlap on purpose, as in the reference. The supporting lines
              hang off the headline's own edges, so the block is shrink-wrapped
              to the headline rather than to the page. */}
          <motion.div
            style={reduce ? undefined : { y: heroTextY, opacity: heroTextFade, filter: heroTextBlur }}
            className="pointer-events-none absolute inset-x-0 top-[24svh] z-0 px-5 lg:px-12"
          >
            {/* The scroll drives the wrapper above; the entrance animates this
                inner block, so the two never write to the same transform. */}
            <motion.div
              initial={reduce ? false : "hidden"}
              animate="shown"
              variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } } }}
              className="mx-auto w-fit"
            >
              <motion.h1
                variants={RISE}
                className="text-center text-[clamp(2.75rem,8.4vw,8rem)] leading-[1.05] font-medium text-white"
              >
                เพิ่มผลตอบแทนหุ้นกู้
              </motion.h1>
              <motion.div variants={RISE} className="mt-6 flex items-start justify-between gap-6 lg:mt-8">
                <p className="flex max-w-[15ch] flex-wrap items-center gap-x-3 gap-y-2 text-lg leading-snug font-medium text-white lg:text-2xl">
                  ส่งสลิปผ่าน LINE
                  <img src={lineIcon} alt="" className="size-8 rounded-xl lg:size-10" />
                  <span className="w-full">และยื่นขอภาษีคืนปีหน้า</span>
                </p>
                <p className="max-w-[22ch] text-right text-sm leading-relaxed font-light text-white/90 lg:text-lg">
                  แพลตฟอร์มสำหรับบริหารจัดการ
                  <br />
                  พอร์ตหุ้นกู้และเครดิตภาษี
                </p>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* The same headline again, above the device and drawn as an outline.
              Where the device covers the solid copy underneath, this is what
              shows — the letters read as a stroke across the screen. Kept in
              lockstep with the copy below by sharing its transforms. */}
          <motion.div
            aria-hidden
            style={reduce ? undefined : { y: heroTextY, opacity: heroTextFade, filter: heroTextBlur }}
            className="pointer-events-none absolute inset-x-0 top-[24svh] z-30 px-5 lg:px-12"
          >
            <motion.h1
              initial={reduce ? false : { opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto w-fit text-center text-[clamp(2.75rem,8.4vw,8rem)] leading-[1.05] font-medium text-transparent"
              style={{ WebkitTextStroke: "1.5px rgba(255,255,255,0.9)" }}
            >
              เพิ่มผลตอบแทนหุ้นกู้
            </motion.h1>
          </motion.div>

          {/* Act two: the slips fly in and stack inside the device. */}
          <motion.div
            style={reduce ? undefined : { opacity: collectFade, y: collectY }}
            className="pointer-events-none absolute inset-x-0 top-[15svh] z-20 px-5 text-center"
          >
            <p className="text-[clamp(1.5rem,2.8vw,2.4rem)] leading-tight font-medium text-white">
              ทุกใบ 50 ทวิ เก็บสะสมไว้ให้เอง
            </p>
            <p className="mx-auto mt-1.5 max-w-[46ch] text-sm text-white/85 lg:text-base">
              ส่งเข้าแชทตอนไหนก็ได้ ครบทั้งปีเมื่อถึงเวลายื่นภาษี
            </p>
          </motion.div>

          {/* Cloud band behind everything. */}
          <img
            src={clouds}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 w-full select-none"
          />

          {/* The product showcase — the device itself is 3D, pinned over the
              headline, turning to face the camera as the hero scrolls. The flat
              export stands in until the renderer has loaded. */}
          <div className="pointer-events-none absolute inset-x-0 top-[26svh] -bottom-[22svh] z-10 mx-auto max-w-[900px]">
            <Suspense
              fallback={
                <img
                  src={lineWindow}
                  alt="หน้าจอ beond"
                  className="mx-auto h-full w-auto select-none object-contain"
                />
              }
            >
              <HeroScreen3D progress={heroEase} reduce={!!reduce} />
            </Suspense>
          </div>
        </div>
      </section>

      {/* ── Scroll-told story ────────────────────────────────────────────── */}
      <div ref={storyRef} className="relative bg-[#F0F2F5]" style={{ height: `${SCENES.length * 100}vh` }}>
        <div className="sticky top-0 flex h-svh items-center overflow-hidden px-5 lg:px-16">
          <div className="mx-auto grid w-full max-w-[1240px] items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="relative min-h-[13rem] lg:min-h-[19rem]">
              {SCENES.map((s, n) => (
                <SceneText key={s.key} scene={s} index={n} total={SCENES.length} p={storyP} reduce={!!reduce} />
              ))}
            </div>
            <div className="relative h-[46svh] lg:h-[74svh]">
              {SCENES.map((s, n) => (
                <SceneArt key={s.key} scene={s} index={n} total={SCENES.length} p={storyP} reduce={!!reduce} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="bg-[linear-gradient(180deg,#F0F2F5_0%,#779BC6_100%)] px-5 py-24 text-center lg:py-32">
        <h2 className="text-[clamp(2rem,4.6vw,3.75rem)] leading-tight font-medium text-white">
          เริ่มเก็บภาษีคืนตั้งแต่งวดนี้
        </h2>
        <p className="mx-auto mt-4 max-w-[52ch] text-base leading-relaxed text-white/85 lg:text-xl">
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

      <footer className="bg-white px-5 py-10 lg:px-12">
        <div className="mx-auto flex max-w-[1360px] flex-col items-center gap-6 lg:flex-row lg:items-end lg:justify-between">
          <span
            className="block h-6 w-auto shrink-0 [&_svg]:h-full [&_svg]:w-auto"
            style={{ ["--fill-0" as string]: "#43507F" }}
            aria-label="beond"
            dangerouslySetInnerHTML={{ __html: wordmark }}
          />
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-[#2968A5]/60">
            <span>Copyright © 2026 Paypers. All rights reserved.</span>
            <a href="/terms" className="transition hover:text-[#2968A5]">เงื่อนไขการใช้งาน</a>
            <a href="/privacy" className="transition hover:text-[#2968A5]">นโยบายความเป็นส่วนตัว</a>
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
  const span = 1 / total;
  const start = index * span;
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
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
  const opacity = useTransform(p, [a, b, c, d], [0, 1, 1, 0]);
  const y = useTransform(p, [a, b, c, d], [40, 0, 0, -40]);
  return (
    <motion.div
      style={reduce ? undefined : { opacity, y }}
      className={`inset-0 flex flex-col justify-center ${reduce ? "mb-12" : "absolute"}`}
    >
      <h2 className="text-[clamp(2rem,4.4vw,4rem)] leading-tight font-medium text-[#1B1C1D]">{scene.title}</h2>
      <p className="mt-4 max-w-[46ch] text-base leading-relaxed text-black/55 lg:text-xl">{scene.body}</p>
    </motion.div>
  );
}

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
  const opacity = useTransform(p, [a, b, c, d], [0, 1, 1, 0]);
  const scale = useTransform(p, [a, b, c, d], [0.9, 1, 1, 0.94]);
  return (
    <motion.div
      style={reduce ? undefined : { opacity, scale }}
      className={`inset-0 flex items-center justify-center ${reduce ? "mb-16" : "absolute"}`}
    >
      <img
        src={scene.art}
        alt=""
        aria-hidden
        className={`max-h-full w-auto select-none rounded-[1.75rem] object-contain ${
          scene.portrait ? "shadow-[0_24px_60px_rgba(30,52,89,0.18)]" : ""
        }`}
      />
    </motion.div>
  );
}

