import RefundGauge from "./RefundGauge";
import logoWhite from "../../assets/beond-logo-white.svg";
import stairs from "../../assets/hero-stairs.svg";
import cloudRight from "../../assets/hero-cloud-right.svg";
import cloudFar from "../../assets/hero-cloud-far.svg";
import puff from "../../assets/hero-puff.svg";

const fmtTHB = (n: number) => new Intl.NumberFormat("th-TH").format(Math.round(n));

// Hero card — refund gauge floating above the white step-podium, over a soft
// blue cloud sky. Matches Figma node 695:2536 (aspect ≈ 727×227).
export default function HeroCard({ confirmed, pending }: { confirmed: number; pending: number }) {
  const total = confirmed + pending;
  return (
    <div className="relative h-full min-h-42.5 w-full overflow-hidden rounded-3xl bg-gradient-to-b from-[#779BC6] to-[#F6F4F1]">
      {/* Clouds (back) */}
      <img src={puff} alt="" className="pointer-events-none absolute top-[26%] right-[7%] w-[15%]" />
      <img src={puff} alt="" className="pointer-events-none absolute top-[40%] left-[3%] w-[10%] -scale-x-100" />

      {/* Cream wash — fades the lower half into #F6F4F1 so the podium sits on a
          soft cream base (Figma 695:2581) */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent from-[26%] to-[#F6F4F1]" />

      {/* Back cloud (solid, on top of the cream wash but behind the podium) */}
      <img src={cloudFar} alt="" className="pointer-events-none absolute -bottom-8 -left-32 w-[52%] -scale-x-100" />

      {/* Step podium (bottom centre; height-controlled so its top edge sits
          ≈ 60% down regardless of card width) */}
      <img src={stairs} alt="" className="pointer-events-none absolute -bottom-[80%] left-[54%] h-[112%] w-auto max-w-none -translate-x-1/2 -scale-x-100" />

      {/* Front cloud — sits over the podium's bottom-right */}
      <img src={cloudRight} alt="" className="pointer-events-none absolute -right-8 -bottom-2 w-[40%]" />

      {/* Logo */}
      <div className="absolute top-6 left-6">
        <img src={logoWhite} alt="beond" className="h-[18px] w-auto" />
        <p className="mt-1.5 text-[10px] font-medium text-white/70">Bring Your Bonds Beyond</p>
      </div>

      {/* Legend */}
      <div className="absolute top-6 right-6 flex items-center gap-4 text-sm text-white/85">
        <span className="flex items-center gap-2"><span className="size-3 rounded-full bg-success" /> ยืนยันแล้ว</span>
        <span className="flex items-center gap-2"><span className="size-3 rounded-full bg-white/60" /> ยังไม่ยืนยัน</span>
      </div>

      {/* Gauge + value — centred, floating above the podium top */}
      <div className="absolute top-[13%] left-1/2 h-[50%] w-[30%] min-w-[200px] -translate-x-1/2">
        <RefundGauge confirmed={confirmed} pending={pending} />
        <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
          <p className="font-nunito text-2xl leading-none font-bold text-white drop-shadow">฿{fmtTHB(total)}</p>
          <p className="mt-1.5 text-base font-medium text-white">ยอดภาษีขอคืนได้</p>
        </div>
      </div>
    </div>
  );
}
