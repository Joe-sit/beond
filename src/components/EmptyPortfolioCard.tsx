import { useState } from "react";
import { Button } from "@heroui/react";
import EmptyBondsIllustration from "./icons/EmptyBondsIllustration";
import TicketPlusIcon from "./icons/TicketPlusIcon";
import AddBondModal from "./AddBondModal";

// Shown in place of the allocation + summary cards while the portfolio has no
// bonds. Single, focused call-to-action to add the first bond.
export default function EmptyPortfolioCard() {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="flex flex-col items-center gap-5 rounded-3xl border border-[#E7E7E7] bg-white px-6 py-10 text-center">
      <EmptyBondsIllustration className="w-64 max-w-full" />
      <div>
        <p className="text-base font-bold text-[#43507F]">ยังไม่มีหุ้นกู้ในพอร์ต</p>
        <p className="mx-auto mt-1 max-w-xs text-sm text-black/50">
          เพิ่มหุ้นกู้ตัวแรกเพื่อดูสัดส่วนการลงทุน ดอกเบี้ยเฉลี่ย และปฏิทินดอกเบี้ยของคุณ
        </p>
      </div>
      <Button variant="primary" onPress={() => setAddOpen(true)}>
        <TicketPlusIcon size={18} />
        เพิ่มหุ้นกู้
      </Button>

      <AddBondModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={() => {}} />
    </div>
  );
}
