import { useState } from "react";
import { Button } from "@heroui/react";
import { IconScan } from "@tabler/icons-react";
import AddBondModal from "./AddBondModal";
import { notifyPortfolioChanged } from "../hooks/usePortfolio";
import mascot from "../assets/figma-mascot.png";

// Blue CTA to add a bond by scanning its 50-ทวิ slip (LINE OCR flow). For now the
// button opens the add-bond search; the camera/LIFF scan flow lands here later.
export default function ScanSlipCard() {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="relative flex min-h-31 items-center overflow-hidden rounded-3xl bg-[#B4CAE4]">
      {/* Mascot pokes up from the bottom-left, clipped to the card */}
      <img
        src={mascot}
        alt=""
        className="pointer-events-none absolute bottom-0 left-2 h-[150%] w-24 object-contain object-bottom"
      />

      <div className="flex flex-1 items-center justify-between gap-3 py-4 pr-4 pl-28">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#43507F]">เพิ่มหุ้นกู้เข้าพอร์ตโฟลิโอ</p>
          <p className="mt-1 text-xs leading-snug text-[#43507F]/90">
            เพียงอัปโหลดไฟล์ 50 ทวิของ
            <br />
            ใบจ่ายหุ้นกู้รายตัว
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          className="shrink-0 bg-[#43507F]"
          onPress={() => setAddOpen(true)}
        >
          <IconScan size={20} />
          สแกนใบหุ้นกู้
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
