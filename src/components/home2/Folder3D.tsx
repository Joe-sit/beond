import wordmark from "../../assets/landing-logo.svg?raw";

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
}: { amount?: string; rx?: number; ry?: number; scale?: number; open?: boolean; part?: "full" | "sheet" | "cover" }) {
  const openDeg = open ? -125 : 0; // swing the cover about the left spine
  return (
    <div style={{ perspective: 1400, width: W + 60, height: H + 40 }}>
      <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: `scale(${scale}) rotateX(${rx}deg) rotateY(${ry}deg)` }}>
        {/* White slip sheet */}
        {part !== "cover" && (
        <Slab w={W} h={H} cx={0} z={0} radius={0} col={SHEET}>
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
  );
}
