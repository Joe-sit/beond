import { useEffect, useRef, useState } from "react";
import {
  IconX,
  IconCamera,
  IconPhoto,
  IconLoader2,
  IconCheck,
  IconAlertTriangle,
  IconRotate,
} from "@tabler/icons-react";
import { EMPTY_SLIP, type SlipFields } from "../lib/scanTypes";
import { extractSlip, saveTaxDocument } from "../lib/taxDocuments";
import { useHoldings } from "../hooks/usePortfolio";
import { issuerName } from "../lib/issuerLogo";

// One bond the user holds — offered as a picker so OCR misses on the bond code
// can be fixed by choosing from the portfolio (which also fills the issuer name).
export interface BondOption {
  symbol: string;
  issuer: string;
}

type Step = "camera" | "detecting" | "review" | "done";

interface ScanFlowProps {
  open: boolean;
  onClose: () => void;
  onSubmit?: (fields: SlipFields) => void;
}

// Full-screen, mobile-first flow for scanning a 50-ทวิ slip inside the LIFF
// web-app (Figma rich-menu → /scan). State machine:
//   camera → (capture) → detecting → review (transcript + edit) → done
// Camera uses the rear lens via getUserMedia; if that's unavailable (desktop,
// denied permission) it falls back to a file picker.
export default function ScanFlow({ open, onClose, onSubmit }: ScanFlowProps) {
  const [step, setStep] = useState<Step>("camera");
  const [shot, setShot] = useState<string | null>(null); // captured frame (dataURL)
  const [fields, setFields] = useState<SlipFields>(EMPTY_SLIP);
  const [camError, setCamError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { holdings } = useHoldings();
  const bondOptions: BondOption[] = holdings.map((h) => ({ symbol: h.symbol, issuer: h.issuer }));

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reset to the camera step every time the sheet opens.
  useEffect(() => {
    if (open) {
      setStep("camera");
      setShot(null);
      setFields(EMPTY_SLIP);
      setCamError(null);
      setSaveError(null);
      setSaving(false);
    }
  }, [open]);

  // Start/stop the rear camera alongside the camera step.
  useEffect(() => {
    if (!open || step !== "camera") return;
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        setCamError("ไม่สามารถเปิดกล้องได้ ลองอัปโหลดรูปแทน");
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, step]);

  if (!open) return null;

  // Freeze the live frame into a still, then kick off detection.
  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      setShot(URL.createObjectURL(blob));
      runDetect(blob);
    }, "image/jpeg", 0.92);
  };

  // Fallback path: use a picked file as the captured image.
  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setShot(URL.createObjectURL(file));
    runDetect(file);
  };

  const runDetect = async (image: Blob) => {
    setStep("detecting");
    try {
      const f = await extractSlip(image);
      setFields(f);
      setStep("review");
    } catch (e) {
      setCamError((e as Error).message || "อ่านข้อมูลจากสลิปไม่สำเร็จ ลองใหม่อีกครั้ง");
      setStep("camera");
    }
  };

  const retake = () => {
    setShot(null);
    setSaveError(null);
    setStep("camera");
  };

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    const res = await saveTaxDocument(fields);
    setSaving(false);
    if (res.ok) {
      onSubmit?.(fields);
      setStep("done");
    } else {
      setSaveError(res.error ?? "บันทึกไม่สำเร็จ");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0B1220] text-white">
      <div className="mx-auto flex h-full w-full max-w-md flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-4">
          <button onClick={onClose} className="rounded-full p-1 text-white/80 hover:text-white">
            <IconX size={24} />
          </button>
          <p className="text-sm font-semibold">
            {step === "review" ? "ตรวจสอบข้อมูล" : "สแกนใบ 50 ทวิ"}
          </p>
          <span className="w-6" />
        </header>

        {step === "camera" && (
          <CameraStep
            videoRef={videoRef}
            camError={camError}
            onCapture={capture}
            onPickFile={() => fileRef.current?.click()}
          />
        )}

        {step === "detecting" && <DetectingStep shot={shot} />}

        {step === "review" && (
          <ReviewStep
            shot={shot}
            fields={fields}
            saving={saving}
            saveError={saveError}
            bondOptions={bondOptions}
            onChange={setFields}
            onRetake={retake}
            onSubmit={submit}
          />
        )}

        {step === "done" && <DoneStep onClose={onClose} />}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={pickFile}
        />
      </div>
    </div>
  );
}

// ── Step: live camera + capture frame ───────────────────────────────────────
function CameraStep({
  videoRef,
  camError,
  onCapture,
  onPickFile,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  camError: string | null;
  onCapture: () => void;
  onPickFile: () => void;
}) {
  return (
    <div className="relative flex flex-1 flex-col">
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
        />
        {/* Slip framing guide — align the 50-ทวิ inside the corners */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
          <div className="relative aspect-[3/4] w-full max-w-72">
            {["-top-px -left-px border-t-4 border-l-4 rounded-tl-xl",
              "-top-px -right-px border-t-4 border-r-4 rounded-tr-xl",
              "-bottom-px -left-px border-b-4 border-l-4 rounded-bl-xl",
              "-bottom-px -right-px border-b-4 border-r-4 rounded-br-xl",
            ].map((c) => (
              <span key={c} className={`absolute h-8 w-8 border-white/90 ${c}`} />
            ))}
          </div>
        </div>
        <p className="absolute inset-x-0 bottom-4 text-center text-xs text-white/70">
          วางใบ 50 ทวิให้อยู่ในกรอบ
        </p>
      </div>

      {camError && (
        <div className="flex items-center gap-2 bg-amber-500/15 px-4 py-3 text-xs text-amber-200">
          <IconAlertTriangle size={16} className="shrink-0" />
          {camError}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-8 px-6 py-6">
        <button
          onClick={onPickFile}
          className="flex flex-col items-center gap-1 text-white/70 hover:text-white"
        >
          <IconPhoto size={26} />
          <span className="text-[11px]">อัปโหลด</span>
        </button>
        <button
          onClick={onCapture}
          className="grid h-18 w-18 place-items-center rounded-full bg-white text-[#0B1220] shadow-lg ring-4 ring-white/30 transition-transform active:scale-95"
          aria-label="ถ่ายรูป"
        >
          <IconCamera size={30} />
        </button>
        <span className="w-11" />
      </div>
    </div>
  );
}

// ── Step: detecting / OCR in progress ───────────────────────────────────────
function DetectingStep({ shot }: { shot: string | null }) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center">
      {shot && (
        <img
          src={shot}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-30 blur-sm"
        />
      )}
      <div className="relative flex flex-col items-center gap-4">
        <IconLoader2 size={44} className="animate-spin text-white" />
        <p className="text-sm font-medium">กำลังอ่านข้อมูลจากสลิป…</p>
        <p className="text-xs text-white/60">ระบบกำลังตรวจจับตัวเลขและรายละเอียด</p>
      </div>
    </div>
  );
}

// ── Step: transcript + edit ─────────────────────────────────────────────────
function ReviewStep({
  shot,
  fields,
  saving,
  saveError,
  bondOptions,
  onChange,
  onRetake,
  onSubmit,
}: {
  shot: string | null;
  fields: SlipFields;
  saving: boolean;
  saveError: string | null;
  bondOptions: BondOption[];
  onChange: (f: SlipFields) => void;
  onRetake: () => void;
  onSubmit: () => void;
}) {
  const set = <K extends keyof SlipFields>(k: K, v: SlipFields[K]) =>
    onChange({ ...fields, [k]: v });

  // Picking a bond from the portfolio fills the code and, when the payer name is
  // blank (OCR missed it), the issuer name too.
  const pickBond = (symbol: string) => {
    const sym = symbol.toUpperCase();
    const match = bondOptions.find((b) => b.symbol.toUpperCase() === sym);
    onChange({
      ...fields,
      bond_symbol: symbol || null,
      payer_name: match && !fields.payer_name ? issuerName(match.symbol, match.issuer) : fields.payer_name,
    });
  };
  const setNum = (k: keyof SlipFields, raw: string) => {
    const n = raw.trim() === "" ? null : Number(raw.replace(/[, ]/g, ""));
    set(k, (Number.isNaN(n) ? null : n) as SlipFields[typeof k]);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-t-3xl bg-[#F6F4F1] text-[#1A2233]">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {shot && (
          <img
            src={shot}
            alt="สลิปที่สแกน"
            className="mb-4 h-40 w-full rounded-2xl object-cover"
          />
        )}
        <p className="mb-3 text-xs text-black/50">
          ตรวจสอบและแก้ไขข้อมูลให้ถูกต้องก่อนบันทึก
        </p>

        <Field label="รหัสหุ้นกู้">
          <input
            value={fields.bond_symbol ?? ""}
            onChange={(e) => pickBond(e.target.value)}
            className={inputCls}
            placeholder="เช่น BRI275A"
            list="scan-bond-options"
            autoComplete="off"
          />
          {bondOptions.length > 0 && (
            <datalist id="scan-bond-options">
              {bondOptions.map((b) => (
                <option key={b.symbol} value={b.symbol}>
                  {issuerName(b.symbol, b.issuer)}
                </option>
              ))}
            </datalist>
          )}
        </Field>
        <Field label="ผู้จ่ายเงินได้ (ผู้ออกหุ้นกู้)">
          <input
            value={fields.payer_name ?? ""}
            onChange={(e) => set("payer_name", e.target.value || null)}
            className={inputCls}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="วันที่จ่าย">
            <input
              type="date"
              value={fields.pay_date ?? ""}
              onChange={(e) => set("pay_date", e.target.value || null)}
              className={inputCls}
            />
          </Field>
          <Field label="ปีภาษี (พ.ศ.)">
            <input
              inputMode="numeric"
              value={fields.tax_year ?? ""}
              onChange={(e) => setNum("tax_year", e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="เงินได้ (บาท)">
            <input
              inputMode="decimal"
              value={fields.gross_amount ?? ""}
              onChange={(e) => setNum("gross_amount", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="ภาษีหัก ณ ที่จ่าย (บาท)">
            <input
              inputMode="decimal"
              value={fields.wht_amount ?? ""}
              onChange={(e) => setNum("wht_amount", e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="คงเหลือจ่ายจริง (บาท)">
            <input
              inputMode="decimal"
              value={fields.net_amount ?? ""}
              onChange={(e) => setNum("net_amount", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="อัตราภาษี (%)">
            <input
              inputMode="decimal"
              value={fields.wht_rate ?? ""}
              onChange={(e) => setNum("wht_rate", e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="เลขที่เอกสาร">
          <input
            value={fields.doc_ref ?? ""}
            onChange={(e) => set("doc_ref", e.target.value || null)}
            className={inputCls}
          />
        </Field>
      </div>

      {/* Actions */}
      <div className="border-t border-black/5 bg-white px-5 py-4">
        {saveError && (
          <p className="mb-2 flex items-center gap-1.5 text-xs text-red-600">
            <IconAlertTriangle size={14} className="shrink-0" />
            {saveError}
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={onRetake}
            disabled={saving}
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-black/10 px-5 py-3 text-sm font-semibold text-[#43507F] disabled:opacity-50"
          >
            <IconRotate size={18} />
            ถ่ายใหม่
          </button>
          <button
            onClick={onSubmit}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-[#43507F] px-5 py-3 text-sm font-bold text-white disabled:opacity-70"
          >
            {saving ? (
              <>
                <IconLoader2 size={18} className="animate-spin" />
                กำลังบันทึก…
              </>
            ) : (
              <>
                <IconCheck size={18} />
                บันทึกเครดิตภาษี
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

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

// ── Step: success ───────────────────────────────────────────────────────────
function DoneStep({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
      <div className="grid h-20 w-20 place-items-center rounded-full bg-[#12BC59]">
        <IconCheck size={44} className="text-white" />
      </div>
      <div>
        <p className="text-lg font-bold">บันทึกสำเร็จ</p>
        <p className="mt-1 text-sm text-white/70">
          บันทึกเครดิตภาษีจากใบ 50 ทวิเรียบร้อยแล้ว
        </p>
      </div>
      <button
        onClick={onClose}
        className="mt-2 rounded-2xl bg-white px-8 py-3 text-sm font-bold text-[#0B1220]"
      >
        เสร็จสิ้น
      </button>
    </div>
  );
}
