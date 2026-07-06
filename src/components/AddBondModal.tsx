import { useEffect, useRef, useState } from "react";
import {
  Modal, ModalBackdrop, ModalContainer, ModalDialog,
  Button, CloseButton, SearchField, TextField, Label, Input, toast,
} from "@heroui/react";
import { ensureCatalog, searchBonds, type BondCandidate } from "../lib/secApi";
import { deriveCouponSchedule } from "../lib/couponSchedule";
import { overrideFor } from "../data/couponOverrides";
import { ratingFor } from "../data/bondRatings";
import { notifyPortfolioChanged } from "../hooks/usePortfolio";
import { supabase, supabaseEnabled } from "../lib/supabase";
import IssuerLogo from "./IssuerLogo";
import { issuerName } from "../lib/issuerLogo";

interface AddBondModalProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

// SEC doesn't classify bonds by industry, and the form no longer asks — new
// bonds land in the "unclassified" sector (migration 0015).
const FALLBACK_SECTOR_ID = "other";

function formatTHB(value: number): string {
  return new Intl.NumberFormat("th-TH").format(value);
}

const FREQ_LABEL: Record<number, string> = {
  1: "ปีละครั้ง",
  2: "ทุก 6 เดือน",
  4: "ทุกไตรมาส",
  12: "ทุกเดือน",
};

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
  const [rating, setRating] = useState(""); // credit rating; "" → nonRate
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

  const reset = () => {
    setTerm("");
    setResults([]);
    setSelected(null);
    setAmount("");
    setRating("");
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
      // The signed-in user's public.users id is carried in the session JWT's
      // app_metadata (set by the line-auth function). RLS keys on it.
      const { data: authData } = await supabase.auth.getUser();
      const publicUserId = authData.user?.app_metadata?.public_user_id as string | undefined;
      if (!publicUserId) throw new Error("ไม่พบผู้ใช้ กรุณาเข้าสู่ระบบใหม่");

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
            sector_id: FALLBACK_SECTOR_ID,
            coupon_rate: selected.couponRate ?? 0,
            total_installments:
              schedule.length ||
              (selected.termYears ? Math.max(1, Math.round(selected.termYears * 2)) : 4),
            maturity_date: selected.maturityDate,
            issue_date: selected.issueDate,
            coupon_freq: freq,
            rating: rating || null,
          })
          .select("id")
          .single();
        if (bondErr) throw bondErr;
        bond = inserted;
      }

      const { data: holding, error: holdErr } = await supabase
        .from("holdings")
        .insert({
          user_id: publicUserId,
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

      notifyPortfolioChanged();
      toast.success(`เพิ่ม ${selected.symbol} เข้าพอร์ตแล้ว`);
      handleClose();
      onAdded();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง";
      setError(msg);
      toast.danger(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <ModalBackdrop isDismissable>
        <ModalContainer placement="center">
          <ModalDialog className="flex h-140 w-full max-w-lg flex-col rounded-3xl bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#43507F]">เพิ่มหุ้นกู้</h3>
          <CloseButton onPress={handleClose} aria-label="ปิด" />
        </div>

        {!selected ? (
          <>
            <SearchField
              value={term}
              onChange={setTerm}
              aria-label="ค้นหาหุ้นกู้"
              className="mt-4"
            >
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input
                  autoFocus
                  placeholder="พิมพ์ชื่อบริษัท / สัญลักษณ์ / ISIN เช่น Origin, ปตท, ORI288B"
                />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
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
                        // Frequency + rating are auto-derived, not user-entered.
                        // Frequency: verified master map wins over parsed/default.
                        setFreq(overrideFor(b.symbol)?.frequency ?? b.frequency ?? 2);
                        // Rating from the TRIS issuer list, keyed by the symbol's
                        // issuer prefix (SEC's feed carries no rating).
                        setRating(ratingFor(b.symbol) ?? "");
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
              <div className="flex items-start justify-between gap-2">
                {/* Company profile: issuer logo + brand name */}
                <div className="flex min-w-0 items-center gap-3">
                  <IssuerLogo
                    symbol={selected.symbol}
                    name={issuerName(selected.symbol, selected.issuer)}
                    size={44}
                  />
                  <div className="min-w-0">
                    <p className="font-nunito text-base font-bold text-[#181D20]">
                      {selected.symbol}
                    </p>
                    <p className="truncate text-xs text-black/60">
                      {issuerName(selected.symbol, selected.issuer)}
                    </p>
                  </div>
                </div>
                {/* Rating auto-derived — read-only. Shown only when known; an
                    unknown rating is not asserted as "unrated". */}
                {rating ? (
                  <span className="shrink-0 rounded-lg bg-[#43507F]/10 px-2 py-1 font-nunito text-xs font-bold text-[#43507F]">
                    {rating}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-lg bg-black/5 px-2 py-1 text-xs text-black/40">
                    ไม่มีข้อมูลเครดิต
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-black/60">
                {selected.couponRate != null && (
                  <span>
                    ดอกเบี้ย <b className="font-nunito">{selected.couponRate}%</b> ต่อปี
                  </span>
                )}
                {/* Frequency auto-parsed from the SEC coupon text / master map. */}
                <span>จ่ายดอกเบี้ย {FREQ_LABEL[freq] ?? "ทุก 6 เดือน"}</span>
                {selected.maturityDate && <span>ครบกำหนด {selected.maturityDate}</span>}
              </div>
            </div>

            <TextField
              value={amount}
              onChange={(v) => {
                const digits = v.replace(/[^\d]/g, "");
                setAmount(digits ? formatTHB(Number(digits)) : "");
              }}
              aria-label="จำนวนเงินลงทุน (บาท)"
              className="flex flex-col gap-1.5"
            >
              <Label className="text-sm font-medium text-black/60">
                จำนวนเงินลงทุน (บาท)
              </Label>
              <Input autoFocus inputMode="numeric" placeholder="เช่น 100,000" className="font-nunito" />
            </TextField>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onPress={() => setSelected(null)}>
                ย้อนกลับ
              </Button>
              <Button variant="primary" fullWidth isDisabled={saving} onPress={handleSave}>
                {saving ? "กำลังบันทึก..." : "เพิ่มเข้าพอร์ต"}
              </Button>
            </div>
          </div>
        )}
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
}
