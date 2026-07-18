import { useEffect } from "react";
import { issuerName } from "../../lib/issuerLogo";
import IssuerLogo from "../IssuerLogo";
import Cube from "./Cube";
import slipThumb from "../../assets/slip-thumb.svg";

export interface CelebrationPayout {
  symbol: string;
  issuer: string;
  installment: string;
}

// Full-screen story beat played when a 50-ทวิ slip matches its coupon: the cube
// flies to centre-screen, a slip paper is tossed into it, and it flips green.
// Self-dismisses after the sequence; tap anywhere to skip.
export default function MatchCelebration({ payout, onDone }: { payout: CelebrationPayout; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      onClick={onDone}
      className="animate-celebrate-backdrop fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/45 backdrop-blur-sm"
    >
      <div className="animate-celebrate-cube-in relative flex flex-col items-center">
        {/* Cube: grey base with the green (confirmed) version fading in on top */}
        <div className="animate-celebrate-impact relative w-52">
          <Cube variant="pending" />
          <div className="animate-celebrate-green absolute inset-0">
            <Cube variant="confirmed">
              <span className="inline-flex rounded-full ring-4 ring-white/80">
                <IssuerLogo symbol={payout.symbol} name={issuerName(payout.symbol, payout.issuer)} size={44} />
              </span>
            </Cube>
          </div>

          {/* Slip paper tossed into the cube */}
          <img
            src={slipThumb}
            alt=""
            className="animate-celebrate-slip pointer-events-none absolute top-[38%] left-1/2 h-24 w-auto -translate-x-1/2 drop-shadow-lg"
          />
        </div>

        <div className="animate-celebrate-caption mt-8 text-center">
          <p className="text-2xl font-bold text-white drop-shadow">ยืนยันสลิปสำเร็จ! 🎉</p>
          <p className="mt-1 text-base text-white/85">
            <span className="font-nunito font-bold">{payout.symbol}</span> · งวด{" "}
            <span className="font-nunito">{payout.installment}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
