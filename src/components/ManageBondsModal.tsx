import { useState } from "react";
import {
  Modal, ModalBackdrop, ModalContainer, ModalDialog,
  Button, CloseButton, Tooltip, TextField, Label, Input, toast,
} from "@heroui/react";
import { IconPencil, IconTrash, IconCheck, IconAlertTriangle } from "@tabler/icons-react";
import { deriveCouponSchedule } from "../lib/couponSchedule";
import { useHoldings, notifyPortfolioChanged, type HoldingDetail } from "../hooks/usePortfolio";
import { supabase } from "../lib/supabase";
import IssuerLogo from "./IssuerLogo";
import { issuerName } from "../lib/issuerLogo";

interface ManageBondsModalProps {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

function formatTHB(v: number): string {
  return new Intl.NumberFormat("th-TH").format(v);
}

const FREQ_LABEL: Record<number, string> = {
  1: "ปีละครั้ง",
  2: "ทุก 6 เดือน",
  4: "ทุกไตรมาส",
  12: "ทุกเดือน",
};

// Rebuild a holding's payout schedule from the new face value (amounts scale
// with the principal). Same derivation the add-bond flow uses.
async function regeneratePayouts(h: HoldingDetail, faceValue: number): Promise<void> {
  if (!supabase) return;
  const schedule = deriveCouponSchedule({
    issueDate: h.issueDate,
    maturityDate: h.maturityDate,
    termYears: null,
    frequency: h.couponFreq ?? 2,
    couponRate: h.couponRate,
    faceValue,
  });
  const { error: upErr } = await supabase
    .from("holdings").update({ face_value: faceValue }).eq("id", h.id);
  if (upErr) throw upErr;
  await supabase.from("payouts").delete().eq("holding_id", h.id);
  if (schedule.length) {
    const { error: payErr } = await supabase.from("payouts").insert(
      schedule.map((p) => ({
        holding_id: h.id,
        installment: p.installment,
        amount: p.amount,
        payout_date: p.date,
      })),
    );
    if (payErr) throw payErr;
  }
}

export default function ManageBondsModal({ open, onClose, onChanged }: ManageBondsModalProps) {
  const { holdings, refetch } = useHoldings();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startEdit = (h: HoldingDetail) => {
    setConfirmId(null);
    setError(null);
    setEditingId(h.id);
    setAmount(formatTHB(h.faceValue));
  };

  const saveEdit = async (h: HoldingDetail) => {
    const faceValue = Number(amount.replace(/,/g, ""));
    if (!faceValue || faceValue <= 0) {
      setError("กรุณากรอกจำนวนเงินให้ถูกต้อง");
      return;
    }
    setBusyId(h.id);
    setError(null);
    try {
      await regeneratePayouts(h, faceValue);
      notifyPortfolioChanged();
      toast.success(`อัปเดต ${h.symbol} เป็น ฿${formatTHB(faceValue)} แล้ว`);
      setEditingId(null);
      refetch();
      onChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "บันทึกไม่สำเร็จ";
      setError(msg);
      toast.danger(msg);
    } finally {
      setBusyId(null);
    }
  };

  const del = async (id: string) => {
    if (!supabase) return;
    setBusyId(id);
    setError(null);
    const { error: delErr } = await supabase.from("holdings").delete().eq("id", id);
    setBusyId(null);
    if (delErr) {
      setError(`ลบไม่สำเร็จ: ${delErr.message}`);
      toast.danger(`ลบไม่สำเร็จ: ${delErr.message}`);
      return;
    }
    const symbol = holdings.find((h) => h.id === id)?.symbol;
    setConfirmId(null);
    notifyPortfolioChanged();
    toast.success(symbol ? `ลบ ${symbol} ออกจากพอร์ตแล้ว` : "ลบหุ้นกู้แล้ว");
    refetch();
    onChanged();
  };

  return (
    <Modal isOpen={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <ModalBackdrop isDismissable>
        <ModalContainer placement="center">
          <ModalDialog className="flex h-140 w-full max-w-lg flex-col rounded-3xl bg-white p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#43507F]">จัดการหุ้นกู้ในพอร์ต</h3>
              <CloseButton onPress={onClose} aria-label="ปิด" />
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
              {holdings.length === 0 ? (
                <p className="py-10 text-center text-sm text-black/40">
                  ยังไม่มีหุ้นกู้ในพอร์ต
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {holdings.map((h) => {
                    const isEditing = editingId === h.id;
                    const isConfirm = confirmId === h.id;
                    const busy = busyId === h.id;
                    const company = issuerName(h.symbol, h.issuer);
                    return (
                      <li
                        key={h.id}
                        className="rounded-2xl border border-[#E7E7E7] p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <IssuerLogo symbol={h.symbol} name={company} size={38} />
                            <div className="min-w-0">
                              <p className="font-nunito text-sm font-bold text-[#181D20]">
                                {h.symbol}
                              </p>
                              <p className="truncate text-xs text-black/60">
                                {company} · {FREQ_LABEL[h.couponFreq ?? 2] ?? "—"}
                              </p>
                            </div>
                          </div>
                          {!isEditing && !isConfirm && (
                            <div className="flex shrink-0 items-center gap-1">
                              <div className="mr-1 text-right">
                                <p className="font-nunito text-sm font-bold text-[#43507F]">
                                  ฿{formatTHB(h.faceValue)}
                                </p>
                                <p className="text-[10px] text-black/40">
                                  <span className="font-nunito">{h.couponRate}</span>% ต่อปี
                                </p>
                              </div>
                              <Tooltip>
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="ghost"
                                  onPress={() => startEdit(h)}
                                  aria-label="แก้ไข"
                                >
                                  <IconPencil size={17} />
                                </Button>
                                <Tooltip.Content>แก้ไขจำนวนเงิน</Tooltip.Content>
                              </Tooltip>
                              <Tooltip>
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-500"
                                  onPress={() => { setEditingId(null); setError(null); setConfirmId(h.id); }}
                                  aria-label="ลบ"
                                >
                                  <IconTrash size={17} />
                                </Button>
                                <Tooltip.Content>ลบออกจากพอร์ต</Tooltip.Content>
                              </Tooltip>
                            </div>
                          )}
                        </div>

                        {/* Edit: change the invested amount (regenerates payouts). */}
                        {isEditing && (
                          <div className="mt-3 flex items-end gap-2">
                            <TextField
                              value={amount}
                              onChange={(v) => {
                                const d = v.replace(/[^\d]/g, "");
                                setAmount(d ? formatTHB(Number(d)) : "");
                              }}
                              aria-label="จำนวนเงินลงทุน (บาท)"
                              className="flex flex-1 flex-col gap-1"
                            >
                              <Label className="text-xs font-medium text-black/50">
                                จำนวนเงินลงทุน (บาท)
                              </Label>
                              <Input autoFocus inputMode="numeric" className="font-nunito" />
                            </TextField>
                            <Button size="sm" variant="secondary" isDisabled={busy} onPress={() => setEditingId(null)}>
                              ยกเลิก
                            </Button>
                            <Button size="sm" variant="primary" isDisabled={busy} onPress={() => saveEdit(h)}>
                              <IconCheck size={15} />
                              {busy ? "บันทึก..." : "บันทึก"}
                            </Button>
                          </div>
                        )}

                        {/* Delete confirmation. */}
                        {isConfirm && (
                          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-red-50 px-3 py-2">
                            <p className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                              <IconAlertTriangle size={15} />
                              ลบหุ้นกู้นี้ + งวดดอกเบี้ยทั้งหมด?
                            </p>
                            <div className="flex shrink-0 gap-1.5">
                              <Button size="sm" variant="secondary" isDisabled={busy} onPress={() => setConfirmId(null)}>
                                ยกเลิก
                              </Button>
                              <Button size="sm" variant="danger" isDisabled={busy} onPress={() => del(h.id)}>
                                {busy ? "ลบ..." : "ลบเลย"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
            <p className="mt-3 text-xs text-black/40">
              แก้จำนวนเงินแล้วงวดดอกเบี้ยจะคำนวณใหม่ · ทุกการเปลี่ยนแปลงอัปเดตพอร์ตทันที
            </p>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
}
