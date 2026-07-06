import { Modal, ModalBackdrop, ModalContainer, ModalDialog, CloseButton } from "@heroui/react";
import { IconClockHour4, IconCircleCheck, IconReceiptTax } from "@tabler/icons-react";
import { useTaxCredits, type TaxDoc } from "../hooks/usePortfolio";
import IssuerLogo from "./IssuerLogo";
import { issuerName } from "../lib/issuerLogo";

interface TaxCreditModalProps {
  open: boolean;
  onClose: () => void;
}

function formatTHB(v: number | null): string {
  return v === null ? "-" : new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2 }).format(v);
}

interface YearGroup {
  year: number | null;
  docs: TaxDoc[];
  confirmedCredit: number;
}

function groupByYear(docs: TaxDoc[]): YearGroup[] {
  const map = new Map<number | null, TaxDoc[]>();
  for (const d of docs) {
    const arr = map.get(d.taxYear) ?? [];
    arr.push(d);
    map.set(d.taxYear, arr);
  }
  return [...map.entries()]
    .sort((a, b) => (b[0] ?? 0) - (a[0] ?? 0))
    .map(([year, ds]) => ({
      year,
      docs: ds,
      confirmedCredit: ds
        .filter((d) => d.status === "confirmed")
        .reduce((s, d) => s + (d.whtAmount ?? 0), 0),
    }));
}

export default function TaxCreditModal({ open, onClose }: TaxCreditModalProps) {
  const { docs } = useTaxCredits();
  const groups = groupByYear(docs);

  return (
    <Modal isOpen={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <ModalBackdrop isDismissable>
        <ModalContainer placement="center">
          <ModalDialog className="flex h-140 w-full max-w-lg flex-col rounded-3xl bg-white p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#43507F]">เครดิตภาษีหัก ณ ที่จ่าย</h3>
              <CloseButton onPress={onClose} aria-label="ปิด" />
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
              {docs.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-14 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#43507F]/5 text-[#43507F]">
                    <IconReceiptTax size={28} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#43507F]">ยังไม่มีสลิปภาษี</p>
                    <p className="mt-1 text-xs text-black/50">
                      ส่งรูป "หนังสือรับรองหักภาษี ณ ที่จ่าย (50 ทวิ)" ใน LINE beond<br />
                      ระบบจะอ่านและสรุปเครดิตภาษีมาที่นี่อัตโนมัติ
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {groups.map((g) => (
                    <div key={g.year ?? "unknown"} className="flex flex-col gap-2">
                      <div className="flex items-baseline justify-between">
                        <p className="text-sm font-bold text-[#43507F]">
                          ปีภาษี <span className="font-nunito">{g.year ?? "—"}</span>
                        </p>
                        <p className="text-xs text-black/50">
                          เครดิตรวม{" "}
                          <span className="font-nunito font-bold text-[#43507F]">
                            ฿{formatTHB(g.confirmedCredit)}
                          </span>
                        </p>
                      </div>

                      <ul className="flex flex-col gap-2">
                        {g.docs.map((d) => {
                          const company = issuerName(d.symbol ?? "", d.payerName ?? "");
                          const pending = d.status === "pending";
                          return (
                            <li
                              key={d.id}
                              className={`flex items-center justify-between gap-3 rounded-2xl border border-[#E7E7E7] p-3 ${
                                pending ? "bg-amber-50/40" : ""
                              }`}
                            >
                              <div className="flex min-w-0 items-center gap-2.5">
                                <IssuerLogo symbol={d.symbol ?? company} name={company} size={38} />
                                <div className="min-w-0">
                                  <p className="truncate font-nunito text-sm font-bold text-[#181D20]">
                                    {d.symbol ?? company}
                                  </p>
                                  <p className="truncate text-xs text-black/55">
                                    {d.payDate ?? "-"} · {d.incomeSubtype ?? "ดอกเบี้ย"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-1">
                                <p className="font-nunito text-sm font-bold text-[#43507F]">
                                  ฿{formatTHB(d.whtAmount)}
                                </p>
                                {pending ? (
                                  <span className="flex items-center gap-1 rounded-lg bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                    <IconClockHour4 size={12} /> รอยืนยันใน LINE
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 rounded-lg bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                                    <IconCircleCheck size={12} /> เครดิตแล้ว
                                  </span>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="mt-3 text-xs text-black/40">
              เครดิต = ภาษีหัก ณ ที่จ่าย (15%) ที่ใช้เครดิตคืนตอนยื่น ภ.ง.ด. · sync จาก LINE อัตโนมัติ
            </p>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
}
