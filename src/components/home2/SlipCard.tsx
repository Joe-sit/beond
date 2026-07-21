import wordmark from "../../assets/landing-logo.svg?raw";

// The "50-ทวิ" slip that stands on the top step of the goal staircase — a beond
// orange cover overlapping a white withholding-tax slip (confirmed badge, net
// amount, barcode). Illustrative: numbers are static placeholders.
export default function SlipCard({ amount = "10,345" }: { amount?: string }) {
  return (
    <div className="relative" style={{ width: 300, height: 400 }}>
      {/* White slip (behind, shifted right) */}
      <div className="absolute right-0 top-2 h-[380px] w-[210px] rounded-2xl bg-white shadow-[0_24px_60px_rgba(30,50,90,0.28)]">
        <div className="flex h-full flex-col px-4 py-4">
          <div className="flex justify-end">
            <span className="rounded-full bg-[#DFF5E6] px-2.5 py-1 text-[11px] font-medium text-[#1BA34B]">ยืนยันแล้ว</span>
          </div>
          <p className="mt-3 text-[11px] text-ink/45">คงเหลือจ่ายจริง</p>
          <p className="font-nunito text-[26px] font-extrabold leading-tight text-ink">฿{amount}</p>
          {/* table */}
          <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-lg border border-black/10">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`h-9 ${i % 2 === 0 ? "border-r" : ""} ${i < 2 ? "border-b" : ""} border-black/10`} />
            ))}
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-2 w-4/5 rounded bg-black/8" />
            <div className="h-2 w-3/5 rounded bg-black/8" />
          </div>
          {/* barcode */}
          <div className="mt-auto h-9 w-full self-end" style={{ background: "repeating-linear-gradient(90deg, #1c1c1c 0 2px, transparent 2px 5px)" }} />
        </div>
      </div>

      {/* Orange beond cover (front, left) */}
      <div className="absolute left-0 top-0 flex h-[360px] w-[150px] flex-col rounded-2xl bg-[#F5871F] px-4 py-5 shadow-[0_20px_50px_rgba(200,110,20,0.35)]">
        <div className="h-5 w-[74px]" style={{ filter: "brightness(0) invert(1)" }} dangerouslySetInnerHTML={{ __html: wordmark }} />
        <p className="mt-1 text-[9px] italic text-white/85">Bring Your Bonds Beyond</p>
      </div>
    </div>
  );
}
