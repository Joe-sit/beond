import { useState } from "react";
import { Button } from "@heroui/react";
import { IconPlus } from "@tabler/icons-react";
import AddBondModal from "./AddBondModal";
import { notifyPortfolioChanged } from "../hooks/usePortfolio";
import mascot from "../assets/figma-mascot.png";

// Primary home CTA to add a bond to the portfolio — search the catalog + confirm
// (NOT scanning; that's the 50-ทวิ tax flow in "จัดการภาษี").
export default function ScanSlipCard() {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="relative flex min-h-27 items-center rounded-3xl bg-[#B4CAE4]">
      {/* Mascot: a fixed 80×124 frame (Figma node 402:1494) that pokes above the
          card top and is clipped so it shows a zoomed crop of the figure — the
          inner img scale/offset mirror the Figma values exactly. */}
      <div className="pointer-events-none absolute bottom-0 left-4 z-10 h-31 w-20 overflow-hidden">
        <img
          src={mascot}
          alt=""
          className="absolute left-[-38.71%] top-[-35.16%] h-[162.67%] w-[182.8%] max-w-none"
        />
      </div>

      <div className="flex flex-1 items-center justify-between gap-3 py-4 pr-4 pl-28">
        <div className="min-w-0">
          <p className="text-base font-bold text-[#43507F]">เพิ่มหุ้นกู้เข้าพอร์ตโฟลิโอ</p>
          <p className="mt-1 text-sm leading-snug text-[#43507F]">
            ค้นหาหุ้นกู้ที่ถือ แล้วยืนยัน
            <br />
            เข้าพอร์ตของคุณ
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          className="shrink-0 rounded-[14px] bg-[#43507F] text-xs"
          onPress={() => setAddOpen(true)}
        >
          <IconPlus size={20} />
          เพิ่มหุ้นกู้
        </Button>
      </div>

      <AddBondModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={notifyPortfolioChanged}
      />
    </div>
  );
}
