import { motion, useReducedMotion } from "motion/react";
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

/** Entrance: each tile lifts in as the grid scrolls into view. */
const TILE = {
  hidden: { opacity: 0, y: 28 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
};

/** The soft diagonal sheen every coloured tile carries in the design. */
const SHEEN =
  "before:pointer-events-none before:absolute before:-inset-px before:rounded-[inherit] " +
  "before:bg-[radial-gradient(120%_90%_at_18%_-10%,rgba(255,255,255,0.16),rgba(255,255,255,0)_58%)]";

function Tile({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <motion.article
      variants={TILE}
      className={`relative isolate overflow-hidden rounded-[2rem] p-7 lg:rounded-[2.5rem] lg:p-10 ${SHEEN} ${className}`}
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

  return (
    <section id="features" className="scroll-mt-24 bg-[#F0F2F5] px-5 py-20 lg:px-12 lg:py-28">
      <motion.div
        initial={reduce ? false : "hidden"}
        whileInView="shown"
        viewport={{ once: true, amount: 0.15 }}
        variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.09 } } }}
        className="mx-auto grid max-w-[1360px] gap-4 lg:grid-cols-12 lg:gap-5"
      >
        {/* Interest timeline dashboard — the widest tile, art bleeding off the
            bottom-right corner the way the design shows it. */}
        <Tile className="bg-[#2968A5] text-white lg:col-span-7 lg:min-h-[26rem]">
          <Title>แดชบอร์ดไทม์ไลน์ดอกเบี้ย</Title>
          <Body className="max-w-[46ch] text-white/80">
            ติดตามทุกรอบการจ่ายดอกเบี้ยของหุ้นกู้ในพอร์ตได้ครบจบในที่เดียว
            พร้อมระบบแจ้งเตือนเงินเข้าให้คุณอุ่นใจทุกเดือน
          </Body>
          <img
            src={dashboardArt}
            alt=""
            className="pointer-events-none mt-6 w-[130%] max-w-none translate-x-[6%] select-none lg:absolute lg:top-[30%] lg:right-[-8%] lg:mt-0 lg:w-[78%] lg:translate-x-0"
          />
          <img
            src={dashboardMascot}
            alt=""
            className="pointer-events-none absolute bottom-0 left-[16%] hidden w-[20%] select-none lg:block"
          />
        </Tile>

        {/* e-Filing — the one light tile, so its CTA reads as the loud one. */}
        <Tile className="bg-white lg:col-span-5 lg:row-span-2">
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
            className="pointer-events-none mx-auto mt-8 w-[70%] select-none lg:absolute lg:inset-x-0 lg:bottom-[8%] lg:mt-0 lg:w-[52%]"
          />
        </Tile>

        {/* Bond coverage. */}
        <Tile className="bg-[#026661] text-white lg:col-span-5 lg:row-span-2 lg:min-h-[34rem]">
          <Title>เข้าถึงหุ้นกู้มากกว่า 900+ รุ่น</Title>
          <Body className="max-w-[42ch] text-white/80">
            ข้อมูลเชื่อถือได้จากกลต. ไม่ว่าคุณจะลงทุนในหุ้นกู้รุ่นใด เราก็ครอบคลุมหมดทุกรุ่น
          </Body>
          <img
            src={bondsArt}
            alt=""
            className="pointer-events-none mx-auto mt-6 w-[86%] select-none lg:absolute lg:bottom-[6%] lg:left-1/2 lg:mt-0 lg:w-[72%] lg:-translate-x-1/2"
          />
        </Tile>

        {/* Brand tile. Two columns of a twelve-column grid, starting at the
            sixth — that is the only span that lands dead centre on the page. */}
        <Tile className="flex flex-col items-center justify-center bg-[#2968A5] text-center text-white lg:col-span-2 lg:col-start-6">
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
        <Tile className="bg-[#84A3CF] text-white lg:col-span-5 lg:col-start-6 lg:min-h-[19rem]">
          <Title>OCR ใบสลิปดอกเบี้ยหุ้นกู้</Title>
          <Body className="max-w-[34ch] text-white/80">
            เพียงสแกนและยืนยันความถูกต้อง แค่นี้ก็พร้อมสำหรับใช้ยื่นภาษีแล้ว
          </Body>
          <img
            src={ocrArt}
            alt=""
            className="pointer-events-none mt-6 ml-auto w-[60%] select-none lg:absolute lg:right-[4%] lg:bottom-[6%] lg:mt-0 lg:w-[38%]"
          />
        </Tile>

        {/* Add the OA as a friend. */}
        <Tile className="bg-[#06C755] text-white lg:col-span-2">
          <div className="flex items-center gap-2">
            <img src={lineMark} alt="" className="size-8 rounded-lg" />
            {/* One line at every width — the tile is only a column wide. */}
            <span className="text-base font-semibold whitespace-nowrap lg:text-lg">มาเป็นเพื่อนกันเถอะ</span>
          </div>
          <img
            src={lineQr}
            alt="LINE QR สำหรับเพิ่มเพื่อน beond"
            className="mx-auto mt-6 w-[9.75rem] rounded-2xl bg-white p-2"
          />
        </Tile>
      </motion.div>
    </section>
  );
}
