/**
 * The beond chat, as it looks inside LINE — rebuilt in DOM so the landing page
 * can tell every feature rather than showing one frozen screenshot.
 *
 * It is laid out at a fixed 390 × 844 (an iPhone's CSS viewport) and scaled to
 * fit whatever it is mounted in, so the type inside stays on the phone's own
 * scale no matter how large the device is drawn.
 *
 * The conversation scrolls itself: `progress` runs 0 → 1 and the column
 * travels from its first message to its last, so scrolling the page walks
 * through the product's story — scan, check, save, add to portfolio, batch,
 * calendar.
 */
import { useEffect, useRef } from "react";
import { motionValue, useMotionValueEvent, type MotionValue } from "motion/react";
import {
  IconMenu2,
  IconNotes,
  IconSearch,
  IconChevronLeft,
  IconBulb,
  IconChartPie,
  IconCalendarDollar,
  IconScan,
  IconKeyboard,
} from "@tabler/icons-react";
import mascot from "../../../assets/landing/bento/dashboard-mascot.svg";
import {
  AddedBondCard,
  BatchSummaryCard,
  CalendarCard,
  SavedSlipCard,
  ScanResultCard,
  TaxIdMismatchCard,
} from "./FlexCards";

/**
 * The whole conversation lives in the DOM at once, but only a screen of it is
 * ever visible through the phone. Without this the browser paints every card
 * on every frame the device moves — with the chat mapped onto a moving 3D
 * frame, that is the single most expensive thing on the landing page.
 */
const SKIP_OFFSCREEN = "[content-visibility:auto] [contain-intrinsic-size:auto_320px]";

/** Stand-in so the hook order never changes when no progress is passed. */
const ZERO = motionValue(0);

export const SCREEN_W = 390;
// Matches the device frame's screen ratio, so the chat fills it exactly.
export const SCREEN_H = 812;

/** A message from beond: avatar, then the bubble, then the time beside it. */
function FromBeond({ time, children }: { time: string; children: React.ReactNode }) {
  return (
    <div className={`flex items-end gap-2 ${SKIP_OFFSCREEN}`}>
      <img src={mascot} alt="" className="size-8 shrink-0 rounded-full bg-white/90 p-[3px]" />
      <div className="min-w-0">{children}</div>
      <span className="mb-1 shrink-0 text-[10px] text-black/35">{time}</span>
    </div>
  );
}

/** A message from the user: right-aligned, LINE's green bubble. */
function FromUser({ time, children }: { time: string; children: React.ReactNode }) {
  return (
    <div className={`flex items-end justify-end gap-2 ${SKIP_OFFSCREEN}`}>
      <span className="mb-1 shrink-0 text-[10px] text-black/35">{time}</span>
      {children}
    </div>
  );
}

/** One of the rich menu's six cells. */
function MenuCell({
  icon,
  label,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-1 text-white ${className}`}>
      {icon}
      <span className="text-[12px] leading-none">{label}</span>
    </div>
  );
}

export default function LineChat({ progress }: { progress?: MotionValue<number> }) {
  const column = useRef<HTMLDivElement>(null);
  const view = useRef<HTMLDivElement>(null);

  // Drive the scroll off the page's own progress. Written straight to the
  // transform: this runs on every scroll frame, and a state update per frame
  // would re-render the whole conversation.
  const scrollTo = (p: number) => {
    const col = column.current;
    const box = view.current;
    if (!col || !box) return;
    const travel = Math.max(0, col.scrollHeight - box.clientHeight);
    col.style.transform = `translate3d(0, ${-travel * Math.min(1, Math.max(0, p))}px, 0)`;
  };
  useMotionValueEvent(progress ?? ZERO, "change", scrollTo);
  useEffect(() => {
    scrollTo(progress?.get() ?? 0);
  });

  return (
    <div
      className="relative flex select-none flex-col overflow-hidden bg-[#8CABD9] font-sans"
      style={{ width: SCREEN_W, height: SCREEN_H }}
    >
      {/* Chat header. LINE keeps it dark over the wallpaper. */}
      <div className="flex h-[52px] shrink-0 items-center gap-3 bg-[#111214] px-3 text-white">
        <IconChevronLeft size={20} stroke={2.2} />
        <span className="-ml-2 text-[13px] font-medium">99+</span>
        <span className="text-[17px] font-semibold tracking-tight">beond</span>
        <div className="ml-auto flex items-center gap-4">
          <IconSearch size={19} stroke={2} />
          <IconNotes size={19} stroke={2} />
          <IconMenu2 size={19} stroke={2} />
        </div>
      </div>

      {/* Conversation. */}
      <div ref={view} className="relative min-h-0 flex-1 overflow-hidden">
        <div ref={column} className="flex flex-col gap-3 px-2 py-4 will-change-transform">
          <div className="self-center rounded-full bg-black/15 px-3 py-[3px] text-[10px] text-white">
            7 สิงหาคม 2569
          </div>

          <FromUser time="11:38">
            {/* The photo the user took of the 50-ทวิ slip. */}
            <img
              src="/illustration/slip-front.png"
              alt=""
              className="w-[150px] rounded-[14px] bg-white p-2 shadow-[0_1px_2px_rgba(0,0,0,0.18)]"
            />
          </FromUser>

          <FromBeond time="11:39">
            <ScanResultCard />
          </FromBeond>

          <FromBeond time="11:39">
            <TaxIdMismatchCard />
          </FromBeond>

          <FromUser time="11:40">
            <span className="rounded-[14px] bg-[#8DE055] px-3 py-2 text-[14px] text-[#1B1C1D]">
              บันทึกเป็นเครดิตภาษี
            </span>
          </FromUser>

          <FromBeond time="11:40">
            <SavedSlipCard />
          </FromBeond>

          <FromBeond time="11:41">
            <AddedBondCard />
          </FromBeond>

          <FromBeond time="11:42">
            <BatchSummaryCard />
          </FromBeond>

          <FromBeond time="11:43">
            <CalendarCard />
          </FromBeond>
        </div>
      </div>

      {/* Rich menu, pinned open the way it is when the chat is first opened. */}
      <div className="shrink-0 bg-[#7E9FD0]">
        {/* The real menu image is 2500 × 1686, so it stands this tall over a
            390px-wide chat — a shorter one reads as a toolbar, not a menu. */}
        <div className="relative flex h-[120px] items-center gap-4 overflow-hidden px-5">
          <IconScan size={30} className="text-white/90" />
          <div className="text-white">
            <div className="text-[17px] font-semibold">สแกนใบ 50 ทวิ</div>
            <div className="text-[12px] text-white/80">ส่งรูปลงในแชทได้เลย</div>
          </div>
          <img src={mascot} alt="" className="absolute right-3 -bottom-2 h-[112px]" />
        </div>
        <div className="grid h-[180px] grid-cols-3 divide-x divide-white/20 border-t border-white/20">
          <MenuCell icon={<IconCalendarDollar size={30} />} label="ปฏิทินรายรับดอกเบี้ย" />
          <MenuCell icon={<IconChartPie size={30} />} label="พอร์ตโฟลิโอของฉัน" />
          <MenuCell icon={<IconBulb size={30} />} label="วิธีการใช้งาน" />
        </div>
      </div>

      {/* Input bar. */}
      <div className="flex h-[46px] shrink-0 items-center justify-between bg-[#111214] px-4 text-white/70">
        <IconKeyboard size={20} />
        <span className="text-[13px]">เมนู ▾</span>
        <span className="w-5" />
      </div>
    </div>
  );
}
