import wordmark from "../../assets/landing-logo.svg?raw";
import { SlipPaper, type SlipPaperData } from "./BondScanStack";

// The beond "50-ทวิ" folder as a real CSS-3D object: a white slip document with
// thickness, and an orange cover raised in front of it (its own thickness), the
// whole thing tilted in an iso camera. Matches the folder SVG (white F9FCFF sheet
// + FF8D27 left cover). Illustrative content on the sheet.
const W = 270; // sheet width
const H = 380; // sheet height
const COVER_W = 150; // orange cover width (~53% like the SVG)
const D = 16; // thickness

const SHEET = { face: "#F9FCFF", side: "#DCE4EC", top: "#EAF0F6" };
const COVER = { face: "#FF8D27", side: "#D9720F", top: "#FF9E45" };

function faceBase(): React.CSSProperties {
  return { position: "absolute", left: "50%", top: "50%" };
}

// A solid slab (front + right + top faces) of size w×h×D, its front carrying
// `children`. `cx` shifts the slab horizontally within the group.
function Slab({
  w, h, cx, z, radius, col, children,
}: {
  w: number; h: number; cx: number; z: number; radius: number;
  col: { face: string; side: string; top: string };
  children?: React.ReactNode;
}) {
  const f = faceBase();
  return (
    <div style={{ position: "absolute", left: "50%", top: "50%", transformStyle: "preserve-3d", transform: `translateX(${cx}px) translateZ(${z}px)` }}>
      {/* front */}
      <div style={{ ...f, width: w, height: h, marginLeft: -w / 2, marginTop: -h / 2, background: col.face, borderRadius: radius, overflow: "hidden", transform: `translateZ(${D / 2}px)` }}>
        {children}
      </div>
      {/* right side */}
      <div style={{ ...f, width: D, height: h, marginLeft: -D / 2, marginTop: -h / 2, background: col.side, transform: `translateX(${w / 2}px) rotateY(90deg)` }} />
      {/* top */}
      <div style={{ ...f, width: w, height: D, marginLeft: -w / 2, marginTop: -D / 2, background: col.top, transform: `translateY(${-h / 2}px) rotateX(90deg)` }} />
      {/* bottom */}
      <div style={{ ...f, width: w, height: D, marginLeft: -w / 2, marginTop: -D / 2, background: col.side, transform: `translateY(${h / 2}px) rotateX(90deg)` }} />
    </div>
  );
}

export default function Folder3D({
  amount = "10,345",
  rx = 8,
  ry = -22,
  scale = 1,
  open = false,
  part = "full",
  blank = false,
  slips = [],
  sink = 0,
  slipScale = 1,
  slipShift = 0,
  slipFront = false,
  focusSlip = null,
}: { amount?: string; rx?: number; ry?: number; scale?: number; open?: boolean; part?: "full" | "sheet" | "cover"; blank?: boolean; slips?: SlipPaperData[]; sink?: number; slipScale?: number; slipShift?: number; slipFront?: boolean; focusSlip?: string | null }) {
  const openDeg = open ? -125 : 0; // swing the cover about the left spine
  // When the folder has sunk, the slips turn front-on: counter-rotate the layer
  // by the group's inverse so they face the camera. The popped slip is driven
  // externally by `focusSlip` (clicking its logo next to "X ใบ").
  const slipFace = slipFront ? `rotateY(${-ry}deg) rotateX(${-rx}deg)` : "";
  // Folder body (sheet + cover) slides down by `sink` while the slip stack
  // stays put — so opening the folder drops it away and leaves the slips.
  const bodySink: React.CSSProperties = { position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: `translateY(${sink}px)`, transition: "transform 700ms cubic-bezier(.5,0,.2,1) 150ms" };
  return (
    <div style={{ perspective: 1400, width: W + 60, height: H + 40 }}>
      <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: `scale(${scale}) rotateX(${rx}deg) rotateY(${ry}deg)` }}>
        {/* Slip stack — its OWN layer on the sheet plane so it stays in place
            when the folder body sinks. Fanned, one sheet per bill to gather. */}
        {slips.length > 0 && (
          <div style={{ position: "absolute", left: "50%", top: "50%", width: W, height: H, marginLeft: -W / 2, marginTop: -H / 2, transformStyle: "preserve-3d", transform: `translateY(${slipShift}px) translateZ(${D / 2 + 3}px) scale(${slipScale}) ${slipFace}`, transformOrigin: "center bottom", transition: "transform 650ms cubic-bezier(.5,0,.2,1)", pointerEvents: "none" }}>
            {slips.map((s, i) => {
              const SC = (W - 34) / 310; // fit the 310px slip to the sheet width
              const hov = slipFront && focusSlip === s.id;
              return (
                <div
                  key={s.id}
                  style={{
                    position: "absolute",
                    left: "50%",
                    bottom: 12 + i * 16,
                    width: 310,
                    transformOrigin: "bottom center",
                    // Hovered slip pops toward the camera + lifts so it can be read.
                    transform: `translateX(-50%) translateX(${(i - (slips.length - 1) / 2) * 20}px) ${hov ? "translateY(-40px) " : ""}scale(${SC * (hov ? 1.12 : 1)}) rotate(${hov ? 0 : (i - (slips.length - 1) / 2) * 6}deg) ${hov ? "translateZ(80px)" : ""}`,
                    transition: "transform 300ms cubic-bezier(.4,0,.2,1)",
                    zIndex: hov ? 50 : i,
                  }}
                >
                  <SlipPaper slip={s} />
                </div>
              );
            })}
          </div>
        )}

        <div style={bodySink}>
        {/* White slip sheet */}
        {part !== "cover" && (
        <Slab w={W} h={H} cx={0} z={0} radius={0} col={SHEET}>
          {!blank && (
          <div className="flex h-full flex-col px-5 py-5">
            <div className="flex justify-end">
              <span className="rounded-full bg-[#DFF5E6] px-2.5 py-1 text-[11px] font-medium text-[#1BA34B]">ยืนยันแล้ว</span>
            </div>
            <p className="mt-3 text-[11px] text-ink/45">คงเหลือจ่ายจริง</p>
            <p className="font-nunito text-[26px] font-extrabold leading-tight text-ink">฿{amount}</p>
            <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-lg border border-black/10">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={`h-9 ${i % 2 === 0 ? "border-r" : ""} ${i < 2 ? "border-b" : ""} border-black/10`} />
              ))}
            </div>
            <div className="mt-3 space-y-2">
              <div className="h-2 w-4/5 rounded bg-black/8" />
              <div className="h-2 w-3/5 rounded bg-black/8" />
            </div>
            <div className="mt-auto h-9 w-full" style={{ background: "repeating-linear-gradient(90deg, #1c1c1c 0 2px, transparent 2px 5px)" }} />
          </div>
          )}
        </Slab>
        )}

        {/* Orange cover — hinged on the left spine so it opens/closes. Outer div
            positions the hinge at the sheet's left edge; inner div does the
            rotateY swing about that origin. Faces are laid out to the RIGHT of
            the hinge. */}
        {part !== "sheet" && (
        <div style={{ position: "absolute", left: "50%", top: "50%", transformStyle: "preserve-3d", transform: `translateX(${-W / 2}px) translateZ(${D + 6}px)` }}>
          <div style={{ position: "absolute", left: 0, top: 0, transformStyle: "preserve-3d", transformOrigin: "left center", transform: `rotateY(${openDeg}deg)`, transition: "transform 700ms cubic-bezier(.5,0,.2,1)" }}>
            {/* front */}
            <div style={{ position: "absolute", left: 0, top: 0, width: COVER_W, height: H, marginTop: -H / 2, background: COVER.face, overflow: "hidden", transform: `translateZ(${D / 2}px)` }}>
              <div className="flex h-full flex-col px-5 py-6">
                <div className="h-6 w-[86px]" style={{ filter: "brightness(0) invert(1)" }} dangerouslySetInnerHTML={{ __html: wordmark }} />
                <p className="mt-1 whitespace-nowrap text-[8px] italic text-white/85">Bring Your Bonds Beyond</p>
              </div>
            </div>
            {/* back of the cover (seen once opened) */}
            <div style={{ position: "absolute", left: 0, top: 0, width: COVER_W, height: H, marginTop: -H / 2, background: COVER.side, transform: `translateZ(${-D / 2}px) rotateY(180deg)`, transformOrigin: "center" }} />
            {/* far (right) edge */}
            <div style={{ position: "absolute", left: 0, top: 0, width: D, height: H, marginTop: -H / 2, marginLeft: -D / 2, background: COVER.side, transform: `translateX(${COVER_W}px) rotateY(90deg)` }} />
            {/* top + bottom edges */}
            <div style={{ position: "absolute", left: 0, top: 0, width: COVER_W, height: D, marginTop: -D / 2, background: COVER.top, transform: `translateY(${-H / 2}px) rotateX(90deg)` }} />
            <div style={{ position: "absolute", left: 0, top: 0, width: COVER_W, height: D, marginTop: -D / 2, background: COVER.side, transform: `translateY(${H / 2}px) rotateX(90deg)` }} />
          </div>
        </div>
        )}
        </div>
      </div>
    </div>
  );
}
