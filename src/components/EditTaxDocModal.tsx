import { useEffect, useState } from "react";
import { Modal, ModalBackdrop, ModalContainer, ModalDialog, Button } from "@heroui/react";
import { IconCheck, IconLoader2, IconAlertTriangle } from "@tabler/icons-react";
import { updateTaxDocument, createTaxDocument } from "../lib/taxDocuments";
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

export interface Draft {
  payer_name: string;
  payer_tax_id: string;
  bond_symbol: string;
  net_amount: string;
  gross_amount: string;
  wht_amount: string;
  wht_rate: string;
  pay_date: string;
  tax_year: string;
}

// net isn't stored — derive it from gross − wht for the editable field.
const deriveNet = (gross: number | null, wht: number | null): string =>
  gross != null && wht != null ? String(Math.round((gross - wht) * 100) / 100) : "";

const fromDoc = (d: TaxDoc): Draft => ({
  payer_name: d.payerName ?? "",
  payer_tax_id: d.payerTaxId ?? "",
  bond_symbol: d.symbol ?? "",
  net_amount: deriveNet(d.grossAmount ?? null, d.whtAmount ?? null),
  gross_amount: d.grossAmount?.toString() ?? "",
  wht_amount: d.whtAmount?.toString() ?? "",
  wht_rate: d.whtRate?.toString() ?? "15",
  pay_date: d.payDate ?? "",
  tax_year: d.taxYear?.toString() ?? "",
});

const emptyDraft = (): Draft => ({
  payer_name: "", payer_tax_id: "", bond_symbol: "",
  net_amount: "", gross_amount: "", wht_amount: "", wht_rate: "15", pay_date: "", tax_year: "",
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
  // Create-mode prefill (e.g. the coupon-sync reminder seeds bond/payer/amount).
  initial?: Partial<Draft>;
}

// Edit a saved 50-ทวิ record — or add one by hand (doc === null). Used from the
// จัดการภาษี ledger for correcting OCR misses and manual entry.
export default function EditTaxDocModal({ doc, open, onClose, onSaved, initial }: Props) {
  const { holdings } = useHoldings();
  const creating = doc === null;
  const [draft, setDraft] = useState<Draft>(() => (doc ? fromDoc(doc) : emptyDraft()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form whenever the modal opens (edit → from the doc, create →
  // blank or seeded from `initial`).
  useEffect(() => {
    if (open) {
      setDraft(doc ? fromDoc(doc) : { ...emptyDraft(), ...initial });
      setError(null);
      setSaving(false);
    }
  }, [open, doc, initial]);

  const set = (k: keyof Draft, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  // Same rule as the scan review: user enters the amount received (net); WHT is a
  // flat 15%, so gross = net / 0.85 and wht = gross − net are back-calculated.
  const setNet = (raw: string) => {
    const n = numOrNull(raw);
    const gross = n == null ? null : Math.round((n / 0.85) * 100) / 100;
    const wht = n == null || gross == null ? null : Math.round((gross - n) * 100) / 100;
    setDraft((d) => ({
      ...d,
      net_amount: raw,
      gross_amount: gross?.toString() ?? "",
      wht_amount: wht?.toString() ?? "",
      wht_rate: "15",
    }));
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    const patch = {
      payer_name: draft.payer_name.trim() || null,
      payer_tax_id: draft.payer_tax_id.trim() || null,
      bond_symbol: draft.bond_symbol.trim() || null,
      gross_amount: numOrNull(draft.gross_amount),
      wht_amount: numOrNull(draft.wht_amount),
      wht_rate: numOrNull(draft.wht_rate),
      pay_date: draft.pay_date || null,
      tax_year: numOrNull(draft.tax_year),
    };
    const res = doc ? await updateTaxDocument(doc.id, patch) : await createTaxDocument(patch);
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
            <h2 className="text-base font-bold text-[#43507F]">{creating ? "เพิ่มรายการภาษี" : "แก้ไขข้อมูลภาษี"}</h2>
            <p className="mt-1 mb-4 text-xs text-black/50">
              {creating ? "กรอกข้อมูลเครดิตภาษีด้วยตนเอง" : "แก้ไขข้อมูลที่ OCR อ่านผิดได้ที่นี่"}
            </p>

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
              <Field label="คงเหลือจ่ายจริง (บาท)">
                <input value={draft.net_amount} onChange={(e) => setNet(e.target.value)} className={inputCls} inputMode="decimal" placeholder="0.00" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="เงินได้ (บาท) · คำนวณ">
                  <input value={draft.gross_amount} readOnly className={`${inputCls} bg-black/5 text-black/60`} placeholder="0.00" />
                </Field>
                <Field label="ภาษีหัก 15% (บาท) · คำนวณ">
                  <input value={draft.wht_amount} readOnly className={`${inputCls} bg-black/5 text-black/60`} placeholder="0.00" />
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
