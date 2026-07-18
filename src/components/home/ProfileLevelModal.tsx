import { Modal, ModalBackdrop, ModalContainer, ModalDialog, CloseButton } from "@heroui/react";
import mascotLvl1 from "../../assets/mascot-lvl1.svg";
import mascotLvl2 from "../../assets/mascot-lvl2.svg";
import mascotLvl3 from "../../assets/mascot-lvl3.svg";
import mascotLvl4 from "../../assets/mascot-lvl4.svg";

// Collector tiers by portfolio face value (Figma component set 695:5044).
export interface Level {
  label: string;
  mascot: string;
  min: number;
  range: string;
}

export const LEVELS: Level[] = [
  { label: "นักก่อร่างสร้างพอร์ต", mascot: mascotLvl1, min: 0, range: "ต่ำกว่า ฿1 ล้าน" },
  { label: "นักสะสมบอนด์มืออาชีพ", mascot: mascotLvl2, min: 1_000_000, range: "฿1 – 3 ล้าน" },
  { label: "นายหน้าคลังเสบียง", mascot: mascotLvl3, min: 3_000_000, range: "฿3 – 10 ล้าน" },
  { label: "วาฬใหญ่น่านน้ำบอนด์", mascot: mascotLvl4, min: 10_000_000, range: "฿10 ล้านขึ้นไป" },
];

// Highest tier the value qualifies for.
export function levelIndex(value: number): number {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) if (value >= LEVELS[i].min) idx = i;
  return idx;
}

export default function ProfileLevelModal({
  open,
  onClose,
  currentIndex,
}: {
  open: boolean;
  onClose: () => void;
  currentIndex: number;
}) {
  return (
    <Modal isOpen={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <ModalBackdrop isDismissable>
        <ModalContainer placement="center">
          <ModalDialog className="flex w-full max-w-md flex-col rounded-3xl bg-white p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink">ระดับนักสะสมบอนด์</h3>
              <CloseButton onPress={onClose} aria-label="ปิด" />
            </div>

            <p className="mt-1 text-sm text-ink-soft">
              ระดับเลื่อนตามมูลค่าพอร์ต (มูลค่าหน้าตั๋วรวม) โดยอัตโนมัติ
            </p>

            <ul className="mt-4 flex flex-col gap-2">
              {LEVELS.map((lvl, i) => {
                const active = i === currentIndex;
                return (
                  <li
                    key={lvl.label}
                    className={`flex items-center gap-3 rounded-2xl border p-3 ${
                      active ? "border-brand bg-brand/5" : "border-line"
                    }`}
                  >
                    <img src={lvl.mascot} alt="" className="h-12 w-12 shrink-0 object-contain" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-bold text-ink">{lvl.label}</p>
                        {active && (
                          <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[11px] font-medium text-white">
                            ระดับปัจจุบัน
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-ink-soft">
                        LVL {i + 1} · {lvl.range}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
}
