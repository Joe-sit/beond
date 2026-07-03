import { ScanText } from "lucide-react";
import { taxCredit } from "../data/mockData";
import mascot from "../assets/mascot-1ee2b3.png";
import moneyIllustration from "../assets/money-illustration.svg";

function formatTHB(value: number): string {
  return new Intl.NumberFormat("th-TH").format(value);
}

export default function BottomCards() {
  return (
    <div className="flex items-end gap-4">
      <div className="relative h-23.25 flex-262 rounded-3xl bg-[#B4CAE4]">
        {/* Mascot pokes above the card, clipped to its bottom-left radius */}
        <img
          src={mascot}
          alt=""
          className="absolute bottom-0 left-0 h-31 w-28.5 rounded-bl-3xl object-cover"
        />
        <div className="flex h-full flex-col items-start justify-center gap-1 pl-30.75">
          <p className="text-sm text-[#43507F]">เพิ่มหุ้นกู้ได้เลย</p>
          <button className="flex items-center gap-2 rounded-[14px] bg-[#43507F] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#525f92]">
            <ScanText size={20} />
            สแกนใบหุ้นกู้
          </button>
        </div>
      </div>

      <div className="relative h-23.25 flex-314 rounded-3xl bg-[#F6F4F1]">
        <img
          src={moneyIllustration}
          alt=""
          className="pointer-events-none absolute -top-2 right-2 h-18 w-31.25"
        />
        <div className="flex h-full flex-col justify-center gap-1 pl-4">
          <p className="text-sm font-medium text-black/60">
            เครดิตภาษีที่จะได้คืนปี <span className="font-nunito">{taxCredit.year}</span>
          </p>
          <p className="text-xl font-bold text-[#43507F]">
            ฿<span className="font-nunito">{formatTHB(taxCredit.amount)}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
