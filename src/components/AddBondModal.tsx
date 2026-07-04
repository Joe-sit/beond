import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { ensureCatalog, searchBonds, type BondCandidate } from "../lib/secApi";
import { deriveCouponSchedule } from "../lib/couponSchedule";
import { overrideFor } from "../data/couponOverrides";
import { supabase, supabaseEnabled } from "../lib/supabase";
import { allocationHoldings } from "../data/mockData";

interface AddBondModalProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

const SECTOR_OPTIONS = allocationHoldings.map((h) => ({
  id: h.id,
  label: h.label,
}));

function formatTHB(value: number): string {
  return new Intl.NumberFormat("th-TH").format(value);
}

function ResultSkeleton() {
  return (
    <ul className="flex animate-pulse flex-col gap-2">
      {Array.from({ length: 4 }, (_, i) => (
        <li
          key={i}
          className="flex items-center justify-between gap-3 rounded-2xl border border-[#E7E7E7] p-3"
        >
          <div className="flex flex-col gap-2">
            <span className="h-3.5 w-24 rounded bg-gray-200" />
            <span className="h-3 w-48 rounded bg-gray-100" />
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="h-3.5 w-10 rounded bg-gray-200" />
            <span className="h-3 w-28 rounded bg-gray-100" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function AddBondModal({ open, onClose, onAdded }: AddBondModalProps) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<BondCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<BondCandidate | null>(null);
  const [amount, setAmount] = useState("");
  const [sectorId, setSectorId] = useState(SECTOR_OPTIONS[0].id);
  const [freq, setFreq] = useState(2); // coupon payments per year (SEC omits this)
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Warm the full bond catalog as soon as the modal opens, so free-text
  // searches (company names) answer locally and instantly.
  useEffect(() => {
    if (open) ensureCatalog();
  }, [open]);

  // Debounced search; stale in-flight requests are aborted.
  useEffect(() => {
    if (!open || selected) return;
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
        .then((r) => {
          if (!controller.signal.aborted) setResults(r);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [term, open, selected]);

  if (!open) return null;

  const reset = () => {
    setTerm("");
    setResults([]);
    setSelected(null);
    setAmount("");
    setFreq(2);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = async () => {
    if (!selected || saving) return;
    const faceValue = Number(amount.replace(/,/g, ""));
    if (!faceValue || faceValue <= 0) {
      setError("กรุณากรอกจำนวนเงินลงทุน");
      return;
    }
    if (!supabaseEnabled || !supabase) {
      handleClose();
      onAdded();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("line_user_id", "demo")
        .single();
      if (!user) throw new Error("ไม่พบผู้ใช้");

      // Real coupon schedule derived from the bond's SEC attributes.
      const schedule = deriveCouponSchedule({
        issueDate: selected.issueDate,
        maturityDate: selected.maturityDate,
        termYears: selected.termYears,
        frequency: freq, // user-picked; SEC omits payment frequency
        couponRate: selected.couponRate,
        faceValue,
      });

      let { data: bond } = await supabase
        .from("bonds")
        .select("id")
        .eq("symbol", selected.symbol)
        .maybeSingle();

      if (!bond) {
        const { data: inserted, error: bondErr } = await supabase
          .from("bonds")
          .insert({
            symbol: selected.symbol,
            issuer: selected.issuer,
            sector_id: sectorId,
            coupon_rate: selected.couponRate ?? 0,
            total_installments:
              schedule.length ||
              (selected.termYears ? Math.max(1, Math.round(selected.termYears * 2)) : 4),
            maturity_date: selected.maturityDate,
            issue_date: selected.issueDate,
            coupon_freq: freq,
          })
          .select("id")
          .single();
        if (bondErr) throw bondErr;
        bond = inserted;
      }

      const { data: holding, error: holdErr } = await supabase
        .from("holdings")
        .insert({
          user_id: user.id,
          bond_id: bond!.id,
          face_value: faceValue,
        })
        .select("id")
        .single();
      if (holdErr) throw holdErr;

      // Seed this holding's payout timeline from the derived schedule.
      if (holding && schedule.length) {
        const { error: payErr } = await supabase.from("payouts").insert(
          schedule.map((p) => ({
            holding_id: holding.id,
            installment: p.installment,
            amount: p.amount,
            payout_date: p.date,
          })),
        );
        if (payErr) throw payErr;
      }

      handleClose();
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-3xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#43507F]">เพิ่มหุ้นกู้</h3>
          <button
            onClick={handleClose}
            className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100"
            aria-label="ปิด"
          >
            <X size={20} />
          </button>
        </div>

        {!selected ? (
          <>
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[#E7E7E7] px-4 py-3">
              <Search size={18} className="shrink-0 text-gray-400" />
              <input
                autoFocus
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="พิมพ์ชื่อบริษัท / สัญลักษณ์ / ISIN เช่น Origin, ปตท, ORI288B"
                className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
              />
            </div>
            <p className="mt-2 text-xs text-black/40">
              ข้อมูลตราสารหนี้จาก SEC Open Data API (ก.ล.ต.)
            </p>

            <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
              {searching && results.length === 0 && <ResultSkeleton />}
              {!searching && term.trim().length >= 2 && results.length === 0 && (
                <p className="py-6 text-center text-sm text-black/40">
                  ไม่พบหุ้นกู้ที่ตรงกับ "{term}"
                </p>
              )}
              <ul className="flex flex-col gap-2">
                {results.map((b) => (
                  <li key={b.symbol}>
                    <button
                      onClick={() => {
                        setSelected(b);
                        // Verified master map wins over parsed/default frequency.
                        setFreq(overrideFor(b.symbol)?.frequency ?? b.frequency ?? 2);
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[#E7E7E7] p-3 text-left transition-colors hover:border-[#43507F]/40 hover:bg-[#43507F]/5"
                    >
                      <div className="min-w-0">
                        <p className="font-nunito text-sm font-bold text-[#181D20]">
                          {b.symbol}
                        </p>
                        <p className="truncate text-xs text-black/60">{b.nameTh}</p>
                      </div>
                      <div className="shrink-0 text-right text-xs text-black/60">
                        {b.couponRate != null && (
                          <p className="font-nunito font-bold text-[#43507F]">
                            {b.couponRate}%
                          </p>
                        )}
                        {b.maturityDate && <p>ครบกำหนด {b.maturityDate}</p>}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <div className="rounded-2xl bg-[#F6F4F1] p-4">
              <p className="font-nunito text-base font-bold text-[#181D20]">
                {selected.symbol}
              </p>
              <p className="text-xs text-black/60">{selected.nameTh}</p>
              <div className="mt-1 flex gap-4 text-xs text-black/60">
                {selected.couponRate != null && (
                  <span>
                    ดอกเบี้ย <b className="font-nunito">{selected.couponRate}%</b> ต่อปี
                  </span>
                )}
                {selected.maturityDate && <span>ครบกำหนด {selected.maturityDate}</span>}
              </div>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-black/60">
                จำนวนเงินลงทุน (บาท)
              </span>
              <input
                autoFocus
                inputMode="numeric"
                value={amount}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^\d]/g, "");
                  setAmount(digits ? formatTHB(Number(digits)) : "");
                }}
                placeholder="เช่น 100,000"
                className="rounded-2xl border border-[#E7E7E7] px-4 py-3 font-nunito text-sm outline-none focus:border-[#43507F]/50"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-black/60">กลุ่มอุตสาหกรรม</span>
              <select
                value={sectorId}
                onChange={(e) => setSectorId(e.target.value)}
                className="rounded-2xl border border-[#E7E7E7] bg-white px-4 py-3 text-sm outline-none focus:border-[#43507F]/50"
              >
                {SECTOR_OPTIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-black/60">งวดจ่ายดอกเบี้ย</span>
              <select
                value={freq}
                onChange={(e) => setFreq(Number(e.target.value))}
                className="rounded-2xl border border-[#E7E7E7] bg-white px-4 py-3 text-sm outline-none focus:border-[#43507F]/50"
              >
                <option value={2}>ทุก 6 เดือน (ครึ่งปี)</option>
                <option value={4}>ทุก 3 เดือน (รายไตรมาส)</option>
                <option value={12}>ทุกเดือน</option>
                <option value={1}>ปีละครั้ง</option>
              </select>
              <span className="text-xs text-black/40">
                SEC ไม่ระบุความถี่ — เลือกตามหนังสือชี้ชวน/statement ของหุ้นกู้
              </span>
            </label>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => setSelected(null)}
                className="flex-1 rounded-2xl border border-[#E7E7E7] py-3 text-sm font-bold text-black/60 transition-colors hover:bg-gray-50"
              >
                ย้อนกลับ
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-2xl bg-[#43507F] py-3 text-sm font-bold text-white transition-colors hover:bg-[#525f92] disabled:opacity-60"
              >
                {saving ? "กำลังบันทึก..." : "เพิ่มเข้าพอร์ต"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
