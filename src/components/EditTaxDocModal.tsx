import { useEffect, useState } from "react";
import { Modal, ModalBackdrop, ModalContainer, ModalDialog, Button } from "@heroui/react";
import { IconCheck, IconLoader2, IconAlertTriangle } from "@tabler/icons-react";
import { updateTaxDocument } from "../lib/taxDocuments";
import { useHoldings, type TaxDoc } from "../hooks/usePortfolio";
import { issuerName } from "../lib/issuerLogo";

const inputCls =
  "w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-[#1A2233] outline-none focus:border-[#43507F] focus:ring-2 focus:ring-[#43507F]/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-[11px] font-medium text-black/45">{label}</span>
      {children}
    </label>
  );
}

interface Draft {
  payer_name: string;
  payer_tax_id: string;
  bond_symbol: string;
  gross_amount: string;
  wht_amount: string;
  wht_rate: string;
  pay_date: string;
  tax_year: string;
}

const fromDoc = (d: TaxDoc): Draft => ({
  payer_name: d.payerName ?? "",
  payer_tax_id: d.payerTaxId ?? "",
  bond_symbol: d.symbol ?? "",
  gross_amount: d.grossAmount?.toString() ?? "",
  wht_amount: d.whtAmount?.toString() ?? "",
  wht_rate: d.whtRate?.toString() ?? "",
  pay_date: d.payDate ?? "",
  tax_year: d.taxYear?.toString() ?? "",
});

const numOrNull = (s: string) => {
  const t = s.replace(/[, ]/g, "").trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

interface Props {
  doc: TaxDoc | null;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

// Edit a saved 50-ทวิ record — for correcting OCR misses (company name, amounts,
// bond code) straight from the จัดการภาษี ledger.
export default function EditTaxDocModal({ doc, open, onClose, onSaved }: Props) {
  const { holdings } = useHoldings();
  const [draft, setDraft] = useState<Draft>(() => (doc ? fromDoc(doc) : ({} as Draft)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form whenever a different doc is opened.
  useEffect(() => {
    if (open && doc) {
      setDraft(fromDoc(doc));
      setError(null);
      setSaving(false);
    }
  }, [open, doc]);

  const set = (k: keyof Draft, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const save = async () => {
    if (!doc || saving) return;
    setSaving(true);
    setError(null);
    const res = await updateTaxDocument(doc.id, {
      payer_name: draft.payer_name.trim() || null,
      payer_tax_id: draft.payer_tax_id.trim() || null,
      bond_symbol: draft.bond_symbol.trim() || null,
      gross_amount: numOrNull(draft.gross_amount),
      wht_amount: numOrNull(draft.wht_amount),
      wht_rate: numOrNull(draft.wht_rate),
      pay_date: draft.pay_date || null,
      tax_year: numOrNull(draft.tax_year),
    });
    setSaving(false);
    if (res.ok) {
      onSaved?.();
      onClose();
    } else {
      setError(res.error ?? "บันทึกไม่สำเร็จ");
    }
  };

  return (
    <Modal isOpen={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <ModalBackdrop isDismissable>
        <ModalContainer placement="center">
          <ModalDialog className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl bg-white p-6">
            <h2 className="text-base font-bold text-[#43507F]">แก้ไขข้อมูลภาษี</h2>
            <p className="mt-1 mb-4 text-xs text-black/50">แก้ไขข้อมูลที่ OCR อ่านผิดได้ที่นี่</p>

            <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
              <Field label="บริษัทผู้จ่ายดอกเบี้ย">
                <input
                  value={draft.payer_name}
                  onChange={(e) => set("payer_name", e.target.value)}
                  className={inputCls}
                  placeholder="เช่น บริษัท บีทีเอส กรุ๊ป โฮลดิงส์ จำกัด (มหาชน)"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="รหัสหุ้นกู้ (ถ้ามี)">
                  <input
                    value={draft.bond_symbol}
                    onChange={(e) => set("bond_symbol", e.target.value)}
                    className={inputCls}
                    placeholder="เช่น BTSG28OA"
                    list="edit-bond-options"
                    autoComplete="off"
                  />
                  {holdings.length > 0 && (
                    <datalist id="edit-bond-options">
                      {holdings.map((h) => (
                        <option key={h.symbol} value={h.symbol}>
                          {issuerName(h.symbol, h.issuer)}
                        </option>
                      ))}
                    </datalist>
                  )}
                </Field>
                <Field label="เลขผู้เสียภาษีผู้จ่าย (13 หลัก)">
                  <input
                    value={draft.payer_tax_id}
                    onChange={(e) => set("payer_tax_id", e.target.value)}
                    className={inputCls}
                    inputMode="numeric"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="วันที่จ่าย">
                  <input type="date" value={draft.pay_date} onChange={(e) => set("pay_date", e.target.value)} className={inputCls} />
                </Field>
                <Field label="ปีภาษี (พ.ศ.)">
                  <input value={draft.tax_year} onChange={(e) => set("tax_year", e.target.value)} className={inputCls} inputMode="numeric" />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="เงินได้ (บาท)">
                  <input value={draft.gross_amount} onChange={(e) => set("gross_amount", e.target.value)} className={inputCls} inputMode="decimal" />
                </Field>
                <Field label="ภาษีหัก (บาท)">
                  <input value={draft.wht_amount} onChange={(e) => set("wht_amount", e.target.value)} className={inputCls} inputMode="decimal" />
                </Field>
                <Field label="อัตรา (%)">
                  <input value={draft.wht_rate} onChange={(e) => set("wht_rate", e.target.value)} className={inputCls} inputMode="decimal" />
                </Field>
              </div>
            </div>

            {error && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
                <IconAlertTriangle size={14} className="shrink-0" /> {error}
              </p>
            )}
            <div className="mt-4 flex gap-3">
              <button
                onClick={onClose}
                disabled={saving}
                className="rounded-2xl border border-black/10 px-5 py-3 text-sm font-semibold text-[#43507F] disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <Button
                variant="primary"
                onPress={save}
                isDisabled={saving}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-[#43507F] py-3 text-sm font-bold text-white"
              >
                {saving ? <IconLoader2 size={18} className="animate-spin" /> : <IconCheck size={18} />}
                บันทึก
              </Button>
            </div>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
}
