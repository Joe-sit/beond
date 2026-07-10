import { useEffect, useRef, useState } from "react";
import {
  IconX,
  IconCamera,
  IconPhoto,
  IconLoader2,
  IconCheck,
  IconCircleCheck,
  IconAlertTriangle,
  IconChevronLeft,
  IconChevronDown,
  IconPlus,
  IconList,
  IconSearch,
} from "@tabler/icons-react";
import slipArt from "../assets/review-slip.png";
import taxArt from "../assets/review-tax.png";
import { EMPTY_SLIP, type SlipFields } from "../lib/scanTypes";
import { ensureCatalog, searchBonds, type BondCandidate } from "../lib/secApi";
import { extractSlip, saveTaxDocument } from "../lib/taxDocuments";
import { useHoldings, notifyPortfolioChanged } from "../hooks/usePortfolio";
import { issuerName, issuerTickerFromTaxId } from "../lib/issuerLogo";
import AddBondModal from "./AddBondModal";
import IssuerLogo from "./IssuerLogo";

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
          // Request a high-res rear frame — OCR accuracy needs the detail.
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 2560 },
            height: { ideal: 1440 },
          },
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
  // The video is landscape (2560×1440) but shown portrait via object-cover, which
  // crops the sides — so the user aligns the slip inside the VISIBLE strip only.
  // We must send that same strip to OCR, not the full landscape sensor frame
  // (which puts the slip small + off-center → garbage OCR). Compute the exact
  // object-cover source rect at full sensor resolution.
  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const vw = video.videoWidth, vh = video.videoHeight;
    const rect = video.getBoundingClientRect();
    const scale = Math.max(rect.width / vw, rect.height / vh);
    const sw = Math.min(vw, rect.width / scale);
    const sh = Math.min(vh, rect.height / scale);
    const sx = (vw - sw) / 2, sy = (vh - sh) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    canvas.getContext("2d")?.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
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
      // Typhoon OCR (server) — reads Thai reliably. When OCR completes we jump
      // straight to the edit/review form.
      const slip = await extractSlip(image);
      // Prefer the matched bond's issuer for the payer name; else fall back to the
      // tax-id → issuer map when the name didn't come through.
      const m = bondOptions.find(
        (b) => b.symbol.toUpperCase() === (slip.bond_symbol ?? "").toUpperCase(),
      );
      if (m) slip.payer_name = issuerName(m.symbol, m.issuer);
      else if (!slip.payer_name) {
        const ticker = issuerTickerFromTaxId(slip.payer_tax_id);
        if (ticker) slip.payer_name = issuerName(ticker);
      }
      setFields(slip);
      // Reveal the captured fields one-by-one as feedback, then open the editor.
      const foundCount = CHECK_FIELDS.filter(([k]) => hasValue(slip[k])).length;
      await new Promise((r) => setTimeout(r, 600 + foundCount * 450));
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
    <div className="fixed inset-0 z-[100] flex h-dvh flex-col bg-[#0B1220] text-white">
      <div className="mx-auto flex h-full w-full max-w-md flex-col">
        {/* Header — hidden on the review step, which renders its own */}
        {step !== "review" && (
          <header className="flex items-center justify-between px-4 py-4">
            <button onClick={onClose} className="rounded-full p-1 text-white/80 hover:text-white">
              <IconX size={24} />
            </button>
            <p className="text-sm font-semibold">สแกนใบ 50 ทวิ</p>
            <span className="w-6" />
          </header>
        )}

        {step === "camera" && (
          <CameraStep
            videoRef={videoRef}
            camError={camError}
            onCapture={capture}
            onPickFile={() => fileRef.current?.click()}
          />
        )}

        {step === "detecting" && <DetectingStep shot={shot} fields={fields} />}

        {step === "review" && (
          <ReviewStep
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

// Live frame quality — samples the center of the video (where the slip's framing
// guide sits) and reports brightness + sharpness so we can coach the user before
// they shoot. Cheap: runs on a 160×120 grayscale downscale.
interface FrameQuality {
  ok: boolean;
  msg: string;
  tone: "good" | "warn";
}

function analyzeFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): FrameQuality | null {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw) return null;
  const w = 160, h = 200;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  canvas.width = w;
  canvas.height = h;
  // Sample ONLY the center guide region (≈ the framing corners), so the desk
  // around the slip doesn't count — the slip must actually fill the frame.
  const sw = vw * 0.6, sh = vh * 0.72;
  ctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const g = new Float32Array(w * h);
  let sum = 0;
  for (let i = 0; i < w * h; i++) {
    const y = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    g[i] = y;
    sum += y;
  }
  const luma = sum / (w * h);
  // Contrast (stdev of luma) — a printed slip is bright paper + dark text (high
  // stdev); a bare desk / empty frame is near-uniform (low stdev) = no document.
  let varSum = 0;
  for (let i = 0; i < w * h; i++) varSum += (g[i] - luma) ** 2;
  const stdev = Math.sqrt(varSum / (w * h));
  // Mean absolute Laplacian ~ focus/sharpness; low = blurry.
  let lap = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      lap += Math.abs(4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w]);
      n++;
    }
  }
  const sharp = lap / n;

  if (luma < 60) return { ok: false, msg: "แสงน้อยเกินไป — หาที่สว่างขึ้น", tone: "warn" };
  if (luma > 236) return { ok: false, msg: "แสงจ้า/สะท้อน — เอียงใบเลี่ยงแสง", tone: "warn" };
  // A 50-ทวิ that fills the guide has both strong paper/text contrast (stdev)
  // and fine printed detail (sharp). A bare desk or a distant slip fails these.
  if (stdev < 42 || sharp < 10) return { ok: false, msg: "ไม่พบใบ 50 ทวิ — วางใบให้เต็มกรอบ", tone: "warn" };
  return { ok: true, msg: "กำลังเก็บข้อมูล", tone: "good" };
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
  const probeRef = useRef<HTMLCanvasElement | null>(null);
  const [quality, setQuality] = useState<FrameQuality | null>(null);

  // Poll the live frame ~3×/s only to coach the user (pill text + green corners).
  // Capture fires on the shutter tap — no auto-snap.
  useEffect(() => {
    if (!probeRef.current) probeRef.current = document.createElement("canvas");
    const id = setInterval(() => {
      const v = videoRef.current;
      if (!v || !probeRef.current) return;
      setQuality(analyzeFrame(v, probeRef.current));
    }, 300);
    return () => clearInterval(id);
  }, [videoRef]);

  const ready = quality?.ok ?? false;
  const cornerCls = ready ? "border-[#12BC59]" : "border-white/90";

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        {/* Slip framing guide — corners turn green when the frame looks good */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
          <div className="relative aspect-[3/4] w-full max-w-72">
            {["-top-px -left-px border-t-4 border-l-4 rounded-tl-xl",
              "-top-px -right-px border-t-4 border-r-4 rounded-tr-xl",
              "-bottom-px -left-px border-b-4 border-l-4 rounded-bl-xl",
              "-bottom-px -right-px border-b-4 border-r-4 rounded-br-xl",
            ].map((c) => (
              <span key={c} className={`absolute h-8 w-8 transition-colors duration-200 ${cornerCls} ${c}`} />
            ))}
          </div>
        </div>
        {/* Live coaching pill — pinned to the top so the phone browser's bottom
            bar can't hide it */}
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-4">
          <div
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur ${
              ready ? "bg-[#12BC59]/90 text-white" : "bg-black/55 text-white"
            }`}
          >
            {ready ? <IconCircleCheck size={15} /> : <IconAlertTriangle size={15} />}
            {ready ? "พร้อมถ่าย — กดปุ่มถ่ายได้เลย" : quality?.msg ?? "วางใบ 50 ทวิให้อยู่ในกรอบ"}
          </div>
        </div>
      </div>

      {camError && (
        <div className="flex items-center gap-2 bg-amber-500/15 px-4 py-3 text-xs text-amber-200">
          <IconAlertTriangle size={16} className="shrink-0" />
          {camError}
        </div>
      )}

      {/* Controls — shutter ring glows green when the frame looks good.
          shrink-0 + safe-area padding so the mobile browser bar can't hide it */}
      <div className="flex shrink-0 items-center justify-center gap-8 px-6 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <button
          onClick={onPickFile}
          className="flex flex-col items-center gap-1 text-white/70 hover:text-white"
        >
          <IconPhoto size={26} />
          <span className="text-[11px]">อัปโหลด</span>
        </button>
        {/* Manual shutter — ring turns green as a "good to shoot" cue */}
        <div className={`grid h-20 w-20 place-items-center rounded-full p-1 ring-4 ${ready ? "ring-[#12BC59]" : "ring-white/25"}`}>
          <button
            onClick={onCapture}
            className="grid h-full w-full place-items-center rounded-full bg-white text-[#0B1220] shadow-lg transition-transform active:scale-95"
            aria-label="ถ่ายรูป"
          >
            <IconCamera size={30} />
          </button>
        </div>
        <span className="w-11" />
      </div>
    </div>
  );
}

// The fields we report back to the user, in reveal order, with a formatter.
const CHECK_FIELDS: [keyof SlipFields, string, (v: SlipFields[keyof SlipFields]) => string][] = [
  ["bond_symbol", "รุ่นหุ้นกู้", (v) => String(v)],
  ["payer_name", "บริษัทผู้จ่าย", (v) => String(v)],
  ["payer_tax_id", "เลขผู้เสียภาษีผู้จ่าย", (v) => String(v)],
  ["gross_amount", "เงินได้", (v) => `฿${Number(v).toLocaleString("th-TH")}`],
  ["wht_amount", "ภาษีหัก ณ ที่จ่าย", (v) => `฿${Number(v).toLocaleString("th-TH")}`],
];
const hasValue = (v: unknown) => v !== null && v !== undefined && v !== "";

// ── Step: detecting / OCR + per-field capture feedback ──────────────────────
function DetectingStep({ shot, fields }: { shot: string | null; fields: SlipFields }) {
  const found = CHECK_FIELDS.filter(([k]) => hasValue(fields[k]));
  const scanning = found.length === 0;

  // Reveal the found fields one-by-one once OCR lands.
  const [reveal, setReveal] = useState(0);
  useEffect(() => {
    if (!found.length) return;
    setReveal(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setReveal(i);
      if (i >= found.length) clearInterval(id);
    }, 450);
    return () => clearInterval(id);
  }, [found.length]);

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center px-6">
      {shot && (
        <img src={shot} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20 blur-sm" />
      )}
      {scanning ? (
        <div className="relative flex flex-col items-center gap-4">
          <IconLoader2 size={44} className="animate-spin text-white" />
          <p className="text-sm font-medium">กำลังอ่านข้อมูลจากสลิป…</p>
          <p className="text-xs text-white/60">ระบบกำลังตรวจจับตัวเลขและรายละเอียด</p>
        </div>
      ) : (
        <div className="relative w-full max-w-xs">
          <p className="mb-3 text-center text-sm font-medium text-white">อ่านข้อมูลได้แล้ว</p>
          <ul className="flex flex-col gap-2">
            {found.map(([k, label, fmt], i) => (
              <li
                key={k}
                className={`flex items-center gap-2.5 rounded-xl bg-white/10 px-3 py-2 transition-all duration-300 ${
                  i < reveal ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
                }`}
              >
                <IconCircleCheck size={18} className="shrink-0 text-[#12BC59]" />
                <span className="min-w-0 flex-1 text-xs text-white/70">{label}</span>
                <span className="truncate text-xs font-bold text-white">{fmt(fields[k])}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Step: transcript + edit ─────────────────────────────────────────────────
function ReviewStep({
  fields,
  saving,
  saveError,
  bondOptions,
  onChange,
  onRetake,
  onSubmit,
}: {
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

  const setNum = (k: keyof SlipFields, raw: string) => {
    const n = raw.trim() === "" ? null : Number(raw.replace(/[, ]/g, ""));
    set(k, (Number.isNaN(n) ? null : n) as SlipFields[typeof k]);
  };

  const bondUnheld = !!fields.bond_symbol && !bondOptions.some((b) => b.symbol === fields.bond_symbol);
  const [addOpen, setAddOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Pick a bond from the sheet (portfolio or SEC search) → set the code and,
  // when the payer is blank, its issuer name.
  const pickBondFromSheet = (symbol: string, name?: string) => {
    const match = bondOptions.find((b) => b.symbol.toUpperCase() === symbol.toUpperCase());
    onChange({
      ...fields,
      bond_symbol: symbol,
      payer_name: fields.payer_name || (match ? issuerName(match.symbol, match.issuer) : name ?? null),
    });
    setSheetOpen(false);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#779BC6] text-[#1B1C1D]">
      {/* Header — fixed */}
      <div className="relative shrink-0 px-4 pt-5 pb-3">
        <img src={slipArt} alt="" className="pointer-events-none absolute top-2 right-3 h-20 w-28 object-contain" />
        <div className="relative flex items-center gap-2">
          <button
            onClick={onRetake}
            className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white"
            aria-label="ย้อนกลับ"
          >
            <IconChevronLeft size={22} />
          </button>
          <h2 className="text-lg font-bold text-white">ตรวจสอบข้อมูล</h2>
        </div>
        <p className="relative mt-2 max-w-[230px] text-xs leading-normal font-medium text-white/80">
          กรุณาตรวจสอบข้อมูลการได้รับดอกเบี้ยก่อนทำการบันทึก
        </p>
      </div>

      {/* Only this fields region scrolls; rounded top clips the content */}
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto rounded-t-3xl">
        {/* Bond + payer */}
        <div className="flex flex-col gap-4 rounded-t-3xl bg-[#F6F4F1] px-4 pt-5 pb-5">
          <div className="block pt-2">
            <span className="mb-2 block text-xs font-medium text-[#1B1C1D]/80">รหัสหุ้นกู้</span>
            <div className="flex items-center gap-2 border-b border-[#779BC6] pb-3">
              {/* Typable — free text, upper-cased like a bond code */}
              <input
                value={fields.bond_symbol ?? ""}
                onChange={(e) => set("bond_symbol", e.target.value.toUpperCase() || null)}
                className={bigInput}
                placeholder="พิมพ์รหัส เช่น BRI275A"
                autoComplete="off"
              />
              <button
                onClick={() => setSheetOpen(true)}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-[#2968A5]/10 px-2.5 py-1.5 text-xs font-medium text-[#2968A5]"
              >
                <IconList size={14} /> เลือกจากพอร์ต
              </button>
            </div>
            {bondUnheld && (
              <button
                onClick={() => setAddOpen(true)}
                className="mt-2 flex items-center gap-1 text-xs font-medium text-[#2968A5]"
              >
                <IconPlus size={14} /> รุ่นนี้ยังไม่มีในพอร์ต — เพิ่มเข้าพอร์ต
              </button>
            )}
          </div>
          <LineField label="ผู้จ่ายเงินได้" right={<IconChevronDown size={18} className="shrink-0 text-black/40" />}>
            <input
              value={fields.payer_name ?? ""}
              onChange={(e) => set("payer_name", e.target.value || null)}
              className={bigInput}
              placeholder="ชื่อบริษัทผู้จ่าย"
            />
          </LineField>
        </div>

        {/* Tax banner — overlaps the card above so the rounded corners cut into
            it (no page-color gap at the corners) */}
        <div className="relative -mt-6 rounded-t-3xl bg-[#2968A5] px-6 pt-5 pb-10">
          <img src={taxArt} alt="" className="pointer-events-none absolute top-3 right-4 h-14 w-24 object-contain" />
          <p className="relative text-lg font-bold text-white">การหักภาษี ณ ที่จ่าย</p>
          <p className="relative mt-1 text-xs font-medium text-white/80">
            ภาษีหัก ณ ที่จ่าย 15% · ปีภาษี <span className="font-nunito">{fields.tax_year ?? "-"}</span>
          </p>
        </div>

        {/* Amounts */}
        <div className="relative -mt-6 rounded-t-3xl bg-[#F6F4F1] px-4 pt-5 pb-5">
          <div className="grid grid-cols-2 gap-x-4">
            <LineField label="จำนวนเงินที่จ่าย" right={baht}>
              <input inputMode="decimal" value={fields.gross_amount ?? ""} onChange={(e) => setNum("gross_amount", e.target.value)} className={bigInput} />
            </LineField>
            <LineField label="ภาษีที่หักและนำส่งไว้" right={baht}>
              <input inputMode="decimal" value={fields.wht_amount ?? ""} onChange={(e) => setNum("wht_amount", e.target.value)} className={bigInput} />
            </LineField>
          </div>
          <LineField label="คงเหลือจ่ายจริง" right={baht}>
            <input inputMode="decimal" value={fields.net_amount ?? ""} onChange={(e) => setNum("net_amount", e.target.value)} className={bigInput} />
          </LineField>
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="shrink-0 border-t border-black/5 bg-[#F6F4F1] px-4 pt-3 pb-4">
        {saveError && (
          <p className="mb-2 flex items-center gap-1.5 text-xs text-red-600">
            <IconAlertTriangle size={14} className="shrink-0" /> {saveError}
          </p>
        )}
        <button
          onClick={onSubmit}
          disabled={saving}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-[14px] bg-[#2968A5]/10 text-sm font-bold text-[#2968A5] disabled:opacity-60"
        >
          {saving ? (
            <>
              <IconLoader2 size={18} className="animate-spin" /> กำลังบันทึก…
            </>
          ) : (
            "บันทึกข้อมูล"
          )}
        </button>
      </div>

      {/* Portfolio + SEC-search bond picker (bottom sheet) */}
      <BondSheet
        open={sheetOpen}
        holdings={bondOptions}
        onPick={pickBondFromSheet}
        onClose={() => setSheetOpen(false)}
      />

      {/* Add-to-portfolio for an OCR'd bond not yet held — same flow as the web app */}
      <AddBondModal
        open={addOpen}
        initialTerm={fields.bond_symbol ?? undefined}
        onClose={() => setAddOpen(false)}
        onAdded={() => {
          notifyPortfolioChanged();
          setAddOpen(false);
        }}
      />
    </div>
  );
}

// Bottom-sheet bond picker: type to search the SEC catalog (same searchBonds /
// ensureCatalog path as the web add-bond flow) or tap a bond from the portfolio.
function BondSheet({
  open,
  holdings,
  onPick,
  onClose,
}: {
  open: boolean;
  holdings: BondOption[];
  onPick: (symbol: string, name?: string) => void;
  onClose: () => void;
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<BondCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      ensureCatalog();
      setTerm("");
      setResults([]);
    }
  }, [open]);

  // Debounced SEC search, aborting stale requests — mirrors AddBondModal.
  useEffect(() => {
    if (!open) return;
    if (term.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    const t = setTimeout(() => {
      searchBonds(term, controller.signal)
        .then((r) => !controller.signal.aborted && setResults(r))
        .finally(() => !controller.signal.aborted && setSearching(false));
    }, 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [term, open]);

  if (!open) return null;
  const showSearch = term.trim().length >= 2;

  return (
    <div className="fixed inset-0 z-[110] flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative flex max-h-[82%] flex-col rounded-t-3xl bg-white pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-black/15" />
        <div className="px-4 pb-3">
          <p className="mb-3 text-center text-sm font-bold text-[#43507F]">เลือกหุ้นกู้</p>
          <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-[#F6F4F1] px-3 py-2.5">
            <IconSearch size={16} className="shrink-0 text-black/40" />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="ค้นหารหัส / ชื่อบริษัท"
              className="w-full bg-transparent text-sm text-[#1A2233] outline-none"
              autoFocus
            />
          </div>
        </div>

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          {showSearch ? (
            searching ? (
              <p className="py-6 text-center text-xs text-black/40">กำลังค้นหา…</p>
            ) : results.length === 0 ? (
              <p className="py-6 text-center text-xs text-black/40">ไม่พบหุ้นกู้</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {results.slice(0, 30).map((r) => (
                  <BondRow key={r.symbol} symbol={r.symbol} name={r.nameTh} onClick={() => onPick(r.symbol, r.nameTh)} />
                ))}
              </ul>
            )
          ) : (
            <>
              <p className="mb-2 text-xs font-medium text-black/45">หุ้นกู้ในพอร์ตของคุณ</p>
              {holdings.length === 0 ? (
                <p className="py-6 text-center text-xs text-black/40">ยังไม่มีหุ้นกู้ในพอร์ต — พิมพ์ค้นหาด้านบน</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {holdings.map((h) => (
                    <BondRow key={h.symbol} symbol={h.symbol} name={issuerName(h.symbol, h.issuer)} onClick={() => onPick(h.symbol, h.issuer)} />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BondRow({ symbol, name, onClick }: { symbol: string; name: string; onClick: () => void }) {
  return (
    <li>
      <button
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-2xl border border-[#E7E7E7] p-3 text-left transition-colors active:bg-[#43507F]/5"
      >
        <IssuerLogo symbol={symbol} name={name} size={34} />
        <div className="min-w-0">
          <p className="truncate font-nunito text-sm font-bold text-[#1A2233]">{symbol}</p>
          <p className="truncate text-xs text-black/55">{name}</p>
        </div>
      </button>
    </li>
  );
}

const bigInput =
  "w-full min-w-0 bg-transparent text-base font-bold text-[#1B1C1D] outline-none placeholder:font-normal placeholder:text-black/25";
const baht = <span className="ml-2 shrink-0 text-xs font-medium text-[#1B1C1D]/80">บาท</span>;

// One design row: small label, then a value on an underline with an optional
// trailing element (chevron for pickers, "บาท" for amounts).
function LineField({
  label,
  active,
  right,
  children,
}: {
  label: string;
  active?: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block pt-2">
      <span className="mb-2 block text-xs font-medium text-[#1B1C1D]/80">{label}</span>
      <div className={`flex items-center justify-between border-b pb-3 ${active ? "border-[#779BC6]" : "border-black/20"}`}>
        <div className="min-w-0 flex-1">{children}</div>
        {right}
      </div>
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
