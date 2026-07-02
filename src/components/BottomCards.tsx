import { taxCredit } from "../data/mockData";

function formatTHB(value: number): string {
  return new Intl.NumberFormat("th-TH").format(value);
}

export default function BottomCards() {
  return (
    <div className="flex items-center gap-3">
      <button className="flex flex-1 items-center gap-3 rounded-3xl bg-linear-to-br from-[#7fa3d1] to-[#a9c3e4] p-5 text-left transition-shadow hover:shadow-md">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/25 text-3xl">
          🤖
        </span>
        <span className="text-base font-bold text-white">สแกนใบ</span>
      </button>

      <span className="h-3 w-3 shrink-0 rounded-full bg-slate-200" />

      <div className="flex flex-1 items-center justify-between gap-3 rounded-3xl bg-slate-50 p-5">
        <div>
          <p className="text-xs text-gray-500">
            เครดิตภาษีที่จะได้คืนปี <span className="font-nunito">{taxCredit.year}</span>
          </p>
          <p className="mt-1 font-nunito text-xl font-bold text-gray-900">
            ฿{formatTHB(taxCredit.amount)}
          </p>
        </div>
        <span className="text-3xl">🧾</span>
      </div>
    </div>
  );
}
