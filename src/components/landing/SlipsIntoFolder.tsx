import { useEffect, useState } from "react";
import { motion } from "motion/react";
import Folder3D from "../home2/Folder3D";
import PaperFly from "../home2/PaperFly";
import type { SlipPaperData } from "../home2/BondScanStack";

/**
 * A year's 50-ทวิ pirouetting into the folder — the app's own "slip collected"
 * animation, on a loop.
 *
 * Not a new drawing of it: the same layered Folder3D (sheet behind, cover in
 * front) and the same PaperFly the dashboard plays when a slip is confirmed
 * over LINE, so the landing promises exactly the moment the product delivers.
 * What is dropped is everything that belongs to a modal — the backdrop, the
 * caption, the acknowledge button and the coin it mints — because here it is
 * scenery, not a step to complete.
 */

const SLIPS: SlipPaperData[] = [
  { id: "l1", symbol: "SIRI267A", issuer: "แสนสิริ", installment: "1/2", wht: 1560, net: 8840 },
  { id: "l2", symbol: "ORI288B", issuer: "ออริจิ้น", installment: "2/2", wht: 2310, net: 13090 },
  { id: "l3", symbol: "BTSG28OA", issuer: "บีทีเอส", installment: "1/4", wht: 990, net: 5610 },
];

// The dashboard's own beats: slips fly for ~2.4s + stagger, the cover shuts
// after, and the run restarts a beat later.
const FLY_AT = 400;
const SHUT_AT = FLY_AT + 3000;
const LOOP_AT = SHUT_AT + 1900;

export default function SlipsIntoFolder({ scale = 0.72 }: { scale?: number }) {
  const [run, setRun] = useState(0); // remounting PaperFly is what replays it
  const [phase, setPhase] = useState(0); // 0 folder only → 1 slips flying
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), FLY_AT);
    const t2 = setTimeout(() => setClosed(true), SHUT_AT);
    const t3 = setTimeout(() => {
      setPhase(0);
      setClosed(false);
      setRun((r) => r + 1);
    }, LOOP_AT);
    return () => { [t1, t2, t3].forEach(clearTimeout); };
  }, [run]);

  return (
    // Clipped: the slips start ~800px out, and in the dashboard's full-screen
    // overlay that reads as "from off camera". Here it would be one sheet
    // sailing across the middle of the page, so the panel is the frame they
    // fly into.
    <div className="pointer-events-none relative h-full w-full overflow-hidden">
      {/* Same three layers as the dashboard's overlay: sheet (back), the flying
          slips (middle until the cover shuts, then behind it), cover (front). */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute z-0"
          style={{ left: "50%", top: "18%", transform: "translateX(-50%)", transformOrigin: "bottom center" }}
          animate={{ opacity: 1 }}
          initial={{ opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Folder3D scale={scale} rx={8} ry={-28} part="sheet" blank />
        </motion.div>

        <div className="absolute inset-0" style={{ zIndex: closed ? 1 : 3 }}>
          <PaperFly key={run} play={phase >= 1} slips={SLIPS} left="50%" top="18%" />
        </div>

        <motion.div
          className="absolute z-2"
          style={{ left: "50%", top: "18%", transform: "translateX(-50%)", transformOrigin: "bottom center" }}
          animate={{ opacity: 1 }}
          initial={{ opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Folder3D scale={scale} rx={8} ry={-28} part="cover" open={phase >= 1 && !closed} />
        </motion.div>
      </div>
    </div>
  );
}
