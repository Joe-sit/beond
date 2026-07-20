import { useEffect, useState } from "react";
import { toast, AlertDialog } from "@heroui/react";
import {
  IconClockHour4,
  IconCircleCheck,
  IconReceiptTax,
  IconFileExport,
  IconAlertTriangle,
  IconLoader2,
  IconPuzzle,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { IconPencil } from "@tabler/icons-react";
import { useTaxCredits, currentTaxYearBE, type TaxDoc } from "../hooks/usePortfolio";
import { deleteTaxDocument } from "../lib/taxDocuments";
import IssuerLogo from "./IssuerLogo";
import TaxCard from "./TaxCard";
import TaxSettingCard from "./TaxSettingCard";
import CouponSyncCard from "./CouponSyncCard";
import EditTaxDocModal from "./EditTaxDocModal";
import { issuerName, issuerTicker, issuerTickerFromName, issuerTickerFromTaxId, cleanCompanyName } from "../lib/issuerLogo";
import {
  buildEfilingRows,
  countUnfilable,
  detectExtension,
  syncToExtension,
} from "../lib/efilingSync";

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

// Pushes a year's confirmed slips into the beond browser extension, which then
// autofills them into the RD e-Filing form (40(4)). Only renders when there's at
// least one filable row (confirmed slip with a 13-digit payer tax id).
function EfilingSyncCard({ docs, year }: { docs: TaxDoc[]; year: number }) {
  const rows = buildEfilingRows(docs, year);
  const skipped = countUnfilable(docs, year);
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [state, setState] = useState<"idle" | "syncing" | "done" | "fail">("idle");

  useEffect(() => {
    let alive = true;
    detectExtension().then((ok) => alive && setInstalled(ok));
    return () => {
      alive = false;
    };
  }, []);

  if (rows.length === 0) return null;

  const totalGross = rows.reduce((s, r) => s + r.gross_interest, 0);
  const totalWht = rows.reduce((s, r) => s + r.wht_amount, 0);

  const sync = async () => {
    setState("syncing");
    const ok = await syncToExtension(rows);
    setState(ok ? "done" : "fail");
    if (ok) setInstalled(true);
  };

  return (
    <div className="mt-1 rounded-2xl border border-[#43507F]/15 bg-[#43507F]/5 p-3">
      <div className="flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#43507F]/10 text-[#43507F]">
          <IconFileExport size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#43507F]">กรอก e-Filing อัตโนมัติ</p>
          <p className="mt-0.5 text-xs text-black/55">
            ส่ง <span className="font-nunito font-bold">{rows.length}</span> บริษัท · เงินได้{" "}
            <span className="font-nunito">฿{formatTHB(totalGross)}</span> · ภาษี{" "}
            <span className="font-nunito">฿{formatTHB(totalWht)}</span> ไปยัง Extension
          </p>

          {skipped > 0 && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-700">
              <IconAlertTriangle size={13} className="shrink-0" />
              ข้าม {skipped} สลิป (ไม่มีเลขผู้เสียภาษีผู้จ่าย 13 หลัก)
            </p>
          )}

          {installed === false && state === "idle" && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-black/45">
              <IconPuzzle size={13} className="shrink-0" />
              ยังไม่พบ beond Extension — ติดตั้งก่อนใช้งาน
            </p>
          )}

          <button
            onClick={sync}
            disabled={state === "syncing" || state === "done"}
            className="mt-2.5 flex items-center gap-1.5 rounded-xl bg-[#43507F] px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            {state === "syncing" ? (
              <>
                <IconLoader2 size={15} className="animate-spin" /> กำลังส่ง…
              </>
            ) : state === "done" ? (
              <>
                <IconCircleCheck size={15} /> ส่งข้อมูลแล้ว
              </>
            ) : (
              <>
                <IconFileExport size={15} /> ส่งไปกรอก e-Filing
              </>
            )}
          </button>

          {state === "done" && (
            <p className="mt-1.5 text-[11px] text-emerald-600">
              เปิดหน้า efiling.rd.go.th แล้วกดไอคอน beond เพื่อกรอกอัตโนมัติ
            </p>
          )}
          {state === "fail" && (
            <p className="mt-1.5 text-[11px] text-red-600">
              ส่งไม่สำเร็จ — ตรวจว่าติดตั้ง Extension และรีเฟรชหน้านี้แล้ว
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// "จัดการภาษี" tab — the per-slip withholding-tax ledger, synced from LINE.
export default function TaxManagePanel() {
  const { docs, loading } = useTaxCredits();
  const groups = groupByYear(docs);
  const year = currentTaxYearBE();
  const [editDoc, setEditDoc] = useState<TaxDoc | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openEditor = (doc: TaxDoc | null) => {
    setEditDoc(doc);
    setEditorOpen(true);
  };

  const removeDoc = async (d: TaxDoc) => {
    if (deletingId) return;
    setDeletingId(d.id);
    const res = await deleteTaxDocument(d.id);
    setDeletingId(null);
    if (res.ok) toast.success("ลบรายการภาษีแล้ว");
    else toast.danger(`ลบไม่สำเร็จ: ${res.error ?? "เกิดข้อผิดพลาด"}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-[#43507F]">จัดการภาษี</h2>
          <p className="mt-1 text-xs text-black/50">
            เครดิตภาษีหัก ณ ที่จ่าย (15%) สำหรับยื่น ภ.ง.ด. ปี <span className="font-nunito">{year}</span>
          </p>
        </div>
        {/* Scanning a 50-ทวิ now happens in the LINE chat (send the photo there);
            the web panel keeps only manual entry. */}
        <button
          onClick={() => openEditor(null)}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#43507F] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#43507F]/90"
        >
          <IconPlus size={18} /> เพิ่มเอง
        </button>
      </div>

      <EditTaxDocModal doc={editDoc} open={editorOpen} onClose={() => setEditorOpen(false)} />

      <TaxCard />

      <CouponSyncCard />

      <TaxSettingCard />

      {loading ? (
        <ul className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i} className="flex items-center justify-between gap-3 rounded-2xl border border-[#E7E7E7] bg-white p-3">
              <div className="flex items-center gap-2.5">
                <span className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-black/5" />
                <div className="flex flex-col gap-1.5">
                  <span className="h-3.5 w-24 animate-pulse rounded bg-black/5" />
                  <span className="h-3 w-32 animate-pulse rounded bg-black/5" />
                </div>
              </div>
              <span className="h-4 w-14 animate-pulse rounded bg-black/5" />
            </li>
          ))}
        </ul>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-[#E7E7E7] bg-[#F6F4F1] py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#43507F]/5 text-[#43507F]">
            <IconReceiptTax size={28} />
          </div>
          <div>
            <p className="text-sm font-bold text-[#43507F]">ยังไม่มีสลิปภาษี</p>
            <p className="mt-1 text-xs text-black/50">
              ส่งรูป "หนังสือรับรองหักภาษี ณ ที่จ่าย (50 ทวิ)" ใน LINE beond
              <br />
              ระบบจะอ่านและสรุปเครดิตภาษีมาที่นี่อัตโนมัติ
            </p>
          </div>
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.year ?? "unknown"} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-bold text-[#43507F]">
                ปีภาษี <span className="font-nunito">{g.year ?? "—"}</span>
              </p>
              <p className="text-xs text-black/50">
                ภาษีหัก ณ ที่จ่าย{" "}
                <span className="font-nunito font-bold text-[#43507F]">฿{formatTHB(g.confirmedCredit)}</span>
              </p>
            </div>
            <ul className="flex flex-col gap-2">
              {g.docs.map((d) => {
                // Show the ISSUING COMPANY (who paid the interest), never the
                // withholding bank. Resolve a ticker from the bond code or, when
                // the slip omitted it, from the payer company name → real logo.
                const ticker = d.symbol
                  ? issuerTicker(d.symbol)
                  : issuerTickerFromName(d.payerName) ?? issuerTickerFromTaxId(d.payerTaxId);
                const company =
                  (ticker ? issuerName(ticker) : cleanCompanyName(d.payerName ?? "")) || "ไม่ทราบบริษัท";
                const logoSym = d.symbol ?? ticker ?? "";
                const sub = [d.symbol, d.payDate, d.incomeSubtype ?? "ดอกเบี้ย"].filter(Boolean).join(" · ");
                const pending = d.status === "pending";
                return (
                  <li
                    key={d.id}
                    className={`flex items-center justify-between gap-3 rounded-2xl border border-[#E7E7E7] p-3 ${
                      pending ? "bg-amber-50/40" : "bg-white"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <IssuerLogo symbol={logoSym} name={company} size={38} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[#181D20]">{company}</p>
                        <p className="truncate text-xs text-black/55">{sub}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="flex flex-col items-end gap-1">
                        <p className="font-nunito text-sm font-bold text-[#43507F]">฿{formatTHB(d.whtAmount)}</p>
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
                      <button
                        onClick={() => openEditor(d)}
                        className="rounded-lg p-1.5 text-black/40 transition-colors hover:bg-black/5 hover:text-[#43507F]"
                        aria-label="แก้ไข"
                      >
                        <IconPencil size={16} />
                      </button>
                      <AlertDialog.Root>
                        <AlertDialog.Trigger>
                          <button
                            disabled={deletingId === d.id}
                            className="rounded-lg p-1.5 text-black/40 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            aria-label="ลบ"
                          >
                            {deletingId === d.id ? <IconLoader2 size={16} className="animate-spin" /> : <IconTrash size={16} />}
                          </button>
                        </AlertDialog.Trigger>
                        <AlertDialog.Backdrop>
                          <AlertDialog.Container placement="center">
                            <AlertDialog.Dialog className="flex w-full max-w-sm flex-col gap-3 rounded-3xl bg-white p-6">
                              {({ close }) => (
                                <>
                                  <AlertDialog.Icon status="danger">
                                    <IconTrash size={20} />
                                  </AlertDialog.Icon>
                                  <AlertDialog.Header>
                                    <AlertDialog.Heading className="text-base font-bold text-[#181D20]">
                                      ลบรายการภาษี?
                                    </AlertDialog.Heading>
                                  </AlertDialog.Header>
                                  <AlertDialog.Body className="text-sm text-black/55">
                                    ลบเครดิตภาษีของ <span className="font-semibold text-[#181D20]">{company}</span>{" "}
                                    (฿{formatTHB(d.whtAmount)}) — การลบนี้ย้อนกลับไม่ได้
                                  </AlertDialog.Body>
                                  <AlertDialog.Footer className="mt-3">
                                    <button
                                      onClick={close}
                                      className="rounded-2xl border border-black/10 px-4 py-2.5 text-sm font-semibold text-[#43507F]"
                                    >
                                      ยกเลิก
                                    </button>
                                    <button
                                      onClick={() => { close(); removeDoc(d); }}
                                      className="rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white"
                                    >
                                      ลบ
                                    </button>
                                  </AlertDialog.Footer>
                                </>
                              )}
                            </AlertDialog.Dialog>
                          </AlertDialog.Container>
                        </AlertDialog.Backdrop>
                      </AlertDialog.Root>
                    </div>
                  </li>
                );
              })}
            </ul>
            {g.year !== null && <EfilingSyncCard docs={g.docs} year={g.year} />}
          </div>
        ))
      )}
    </div>
  );
}
