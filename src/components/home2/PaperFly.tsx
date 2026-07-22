import { SlipPaper, type SlipPaperData } from "./BondScanStack";

// "Paper Pirouette" — the keyframers/shshaw flying-paper code from MailboxFly
// (?anim) used verbatim (mf-fly-in / mf-curve-paper / mf-rogue-paper + the 5-deep
// nested .segment chain + paper-shadow), only re-scaled to px and with each sheet
// showing a 50-ทวิ bond slip (sliced across the segments) instead of blank white.
// `play` mounts the run so the CSS animation fires once, settling into the folder.

const SEGMENTS = 5;
const PW = 192; // paper width (px) — matches the folder's white sheet (270×0.72)
const PH = Math.round((PW * 297) / 210); // A-paper aspect
const OFF = 820; // offscreen depth (was 130vmax)

const MOCK: SlipPaperData[] = [
  { id: "p1", symbol: "SIRI267A", issuer: "แสนสิริ", installment: "1/2", wht: 1560, net: 8840 },
  { id: "p2", symbol: "ORI288B", issuer: "ออริจิ้น", installment: "2/2", wht: 2310, net: 13090 },
  { id: "p3", symbol: "BTSG28OA", issuer: "บีทีเอส", installment: "1/4", wht: 990, net: 5610 },
  { id: "p4", symbol: "CPALL285A", issuer: "ซีพี ออลล์", installment: "1/2", wht: 1875, net: 10625 },
  { id: "p5", symbol: "GULF276A", issuer: "กัลฟ์", installment: "2/2", wht: 3120, net: 17680 },
  { id: "p6", symbol: "TRUE28NA", issuer: "ทรู", installment: "1/4", wht: 1440, net: 8160 },
  { id: "p7", symbol: "MINT293A", issuer: "ไมเนอร์", installment: "1/2", wht: 2085, net: 11815 },
  { id: "p8", symbol: "CENTEL27DA", issuer: "เซ็นทรัล", installment: "2/2", wht: 1230, net: 6970 },
  { id: "p9", symbol: "BAM284A", issuer: "บริหารสินทรัพย์", installment: "1/2", wht: 2640, net: 14960 },
  { id: "p10", symbol: "LH285A", issuer: "แลนด์ แอนด์ เฮ้าส์", installment: "1/4", wht: 1710, net: 9690 },
];

// Keyframes + structure ported straight from MailboxFly (SCSS → the same shapes),
// prefixes kept mf-*, units vmin→px, animations play once (fill: both).
const CSS = `
.pf-scene, .pf-scene *, .pf-scene *:before, .pf-scene *:after { box-sizing: border-box; position: relative; }
.pf-scene * { transform-style: preserve-3d; }
.pf-scene {
  --duration: 2.4s; --stagger: .34s; --easing: cubic-bezier(.36,.07,.25,1); --offscreen: ${OFF}px;
  position: absolute; perspective: 4000px;
}
/* tilt the whole stack to the folder's iso angle so slips land matching it */
.pf-scene .papers { width: ${PW}px; height: ${PH}px; transform: rotateX(8deg) rotateY(-28deg); }

.pf-scene .paper {
  --segments: ${SEGMENTS}; --segment: calc(100% * 1 / var(--segments));
  position: absolute; top: 0; left: 0; height: 100%; width: 100%;
  animation: mf-fly-in var(--duration) var(--easing) both;
  animation-delay: calc(var(--i) * var(--stagger));
}
@keyframes mf-fly-in {
  0%, 2% { transform: translateZ(var(--offscreen)) translateY(80%) rotateX(30deg); }
  80%, 100% { transform: translateZ(0px) translateY(0%) rotateX(0deg); }
}
.pf-scene .paper > .segment { height: var(--segment); }

.pf-scene .segment {
  --rotate: 20deg; height: 100%; transform-origin: top center;
  animation: inherit; animation-name: mf-curve-paper;
}
.pf-scene .segment > .segment { top: 98%; }
@keyframes mf-curve-paper {
  0%, 2% { transform: rotateX(var(--rotate, 0deg)); }
  90%, 100% { transform: rotateX(0deg); }
}

.pf-scene .paper.-rogue { transform-origin: top center -60px; }
.pf-scene .paper.-rogue .segment { --rotate: 30deg; animation-name: mf-curve-rogue-paper; }
@keyframes mf-curve-rogue-paper {
  0%, 50% { transform: rotateX(var(--rotate)); }
  100% { transform: rotateX(0deg); }
}
.pf-scene .paper.-rogue > .segment { animation: inherit; animation-name: mf-rogue-paper; transform-origin: left top 240px; }
@keyframes mf-rogue-paper {
  0%, 2% { transform: rotateX(1.5turn); }
  80%, 100% { transform: rotateX(0turn); }
}

/* Slip content sliced per segment so the sheet carries the real 50-ทวิ art. */
.pf-win { position: absolute; inset: 0; overflow: hidden; }
.pf-slice { position: absolute; top: 0; left: 0; width: ${PW}px; height: ${PH}px; }
`;

function Segments({ slip, depth }: { slip: SlipPaperData; depth: number }) {
  if (depth >= SEGMENTS) return null;
  return (
    <div className="segment">
      <div className="pf-win">
        <div className="pf-slice" style={{ transform: `translateY(${-depth * (100 / SEGMENTS)}%)` }}>
          <div style={{ width: 310, transformOrigin: "top left", transform: `scale(${PW / 310})` }}>
            <SlipPaper slip={slip} />
          </div>
        </div>
      </div>
      <Segments slip={slip} depth={depth + 1} />
    </div>
  );
}

export default function PaperFly({ play, slips = MOCK, left = "50%", top = "20%" }: { play: boolean; slips?: SlipPaperData[]; left?: string; top?: string }) {
  if (!play) return null;
  return (
    <div className="pf-scene pointer-events-none" style={{ left, top, transform: "translateX(-50%)" }}>
      <style>{CSS}</style>
      <div className="papers">
        {slips.map((s, i) => (
          <div key={s.id} className={`paper${i === 0 ? " -rogue" : ""}`} style={{ ["--i" as string]: i }}>
            <Segments slip={s} depth={0} />
          </div>
        ))}
      </div>
    </div>
  );
}
