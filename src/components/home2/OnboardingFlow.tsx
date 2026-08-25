import { useEffect, useMemo, useState } from "react";
import {
  IconCheck,
  IconSearch,
} from "@tabler/icons-react";
import { ensureCatalog, searchLocal, type BondCandidate } from "../../lib/secApi";
import { createBondHolding } from "../../lib/holdings";
import { supabase } from "../../lib/supabase";
import {
  PERSONAL_ALLOWANCE,
  marginalRateForIncome,
  refundFromIncome,
  saveAnnualIncome,
  saveMarginalRate,
} from "../../lib/taxSettings";
import { notifyPortfolioChanged } from "../../hooks/usePortfolio";
import type { AuthProfile } from "../../lib/auth";
import wordmark from "../../assets/landing-logo.svg?raw";
import addBondArt from "../../assets/add-bond-main.png";
import coinsArt from "../../assets/landing-coins.svg";
import moneyArt from "../../assets/landing-money-bill.svg";

interface Props {
  /** Signed-in user, for the profile chip in the top rail. */
  profile: AuthProfile;
  /** Bonds already in the portfolio — the add step is satisfied once > 0. */
  holdingCount: number;
  /** Withholding the portfolio is on track to pay this year, for the finale. */
  potentialWht: number;
  onDone: () => void;
}

const STEPS = [
  { key: "bond", label: "เพิ่มหุ้นกู้ที่ถือ" },
  { key: "income", label: "ระบุฐานภาษี" },
  { key: "done", label: "พร้อมใช้งาน" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

const fmt = (n: number) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(Math.round(n));

const HEADING: Record<StepKey, { title: string; body: string }> = {
  bond: {
    title: "เพิ่มหุ้นกู้ที่คุณถือ",
    body: "ค้นหาด้วยรหัสรุ่น เช่น ORI284C แล้วใส่มูลค่าที่ลงทุน — beond จะสร้างปฏิทินดอกเบี้ยทั้งปีให้เอง",
  },
  income: {
    title: "รายได้ต่อปีของคุณ",
    body: "ใช้คำนวณว่าคุณอยู่ฐานภาษีไหน และขอคืนได้เท่าไหร่ — เก็บไว้ในบัญชีคุณเท่านั้น",
  },
  done: {
    title: "พร้อมใช้งานแล้ว",
    body: "เก็บใบ 50 ทวิ ให้ครบทุกงวด แล้ว beond จะรวมยอดให้พร้อมยื่นขอคืนตอนสิ้นปี",
  },
};

/** One illustration per step, shown inside the step's card. */
const STEP_ART: Record<StepKey, { src: string }> = {
  bond: { src: addBondArt },
  income: { src: moneyArt },
  done: { src: coinsArt },
};

/**
 * First-run onboarding — straight to the two inputs beond can't work without,
 * a portfolio and an income, then the payoff. No teaching slides: the user came
 * to set the account up, not to read.
 *
 * One centred column on a flat page: brand rail, the question, the step's card,
 * a single action, and dots for progress. Same shape at every width — the card
 * is what changes per step.
 */
export default function OnboardingFlow({ profile, holdingCount, potentialWht, onDone }: Props) {
  const [i, setI] = useState(0);
  const [term, setTerm] = useState("");
  const [picked, setPicked] = useState<BondCandidate | null>(null);
  const [face, setFace] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  /** Series added during this flow — holdingCount is a snapshot from the page. */
  const [added, setAdded] = useState<string[]>([]);
  const [income, setIncome] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The catalog is a local file; searching it is instant and offline.
  useEffect(() => { ensureCatalog(); }, []);
  const results = useMemo(() => searchLocal(term).slice(0, 8), [term]);

  const step = STEPS[i].key;
  const heading = HEADING[step];
  const incomeNum = Number(income.replace(/[^\d]/g, ""));
  const rate = incomeNum > 0 ? marginalRateForIncome(Math.max(0, incomeNum - PERSONAL_ALLOWANCE)) : null;
  const refund = incomeNum > 0 ? refundFromIncome(potentialWht, incomeNum) : 0;

  const faceNum = Number(face.replace(/[^\d]/g, ""));
  const next = () => setI((n) => Math.min(n + 1, STEPS.length - 1));

  const addBond = async () => {
    if (!picked || !faceNum || adding) return;
    setAdding(true);
    setAddError(null);
    try {
      if (!supabase) throw new Error("ยังไม่ได้เข้าสู่ระบบ");
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.app_metadata?.public_user_id as string | undefined;
      if (!userId) throw new Error("ยังไม่ได้เข้าสู่ระบบ");
      // Frequency isn't in the SEC catalog; semi-annual is the Thai corporate
      // default and the same fallback the add-bond page uses. It's editable in
      // the portfolio afterwards.
      await createBondHolding(picked, faceNum, picked.frequency ?? 2, "", null, userId);
      notifyPortfolioChanged();
      setAdded((a) => [...a, picked.symbol]);
      setPicked(null);
      setFace("");
      setTerm("");
    } catch (e) {
      setAddError((e as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const saveIncome = async () => {
    if (!incomeNum || saving) return;
    setSaving(true);
    setError(null);
    const res = await saveAnnualIncome(incomeNum);
    // Persist the bracket alongside the income: the rest of the app reads the
    // rate, and deriving it in two places is how the two drift apart.
    if (res.ok && rate !== null) await saveMarginalRate(rate);
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
      return;
    }
    notifyPortfolioChanged();
    next();
  };

  const primary =
    step === "bond"
      ? picked
        ? { label: adding ? "กำลังเพิ่ม…" : "เพิ่มเข้าพอร์ต", act: addBond, disabled: !faceNum || adding }
        : { label: "ถัดไป", act: next, disabled: false }
      : step === "income"
        ? { label: saving ? "กำลังบันทึก…" : "บันทึก", act: saveIncome, disabled: !incomeNum || saving }
        : { label: "เริ่มใช้งาน", act: onDone, disabled: false };

  const art = STEP_ART[step];

  return (
    <div className="flex min-h-dvh flex-col bg-[#F7F8FA] font-kanit">
      {/* Brand on the left, the way out on the right — nothing else competes
          with the question in the middle. */}
      <header className="flex shrink-0 items-center justify-between px-6 py-6 lg:px-12">
        <span
          className="block h-6 w-auto shrink-0 text-[#43507F] [&_svg]:h-full [&_svg]:w-auto"
          style={{ ["--fill-0" as string]: "#43507F" }}
          aria-label="beond"
          dangerouslySetInnerHTML={{ __html: wordmark }}
        />
        <div className="flex items-center gap-2">
          {step !== "done" && (
            <button
              onClick={onDone}
              className="rounded-full px-4 py-2 text-sm text-ink/45 transition hover:bg-black/5"
            >
              ข้ามการตั้งค่า
            </button>
          )}
          {/* Who this account belongs to — the same avatar the dashboard shows. */}
          <span className="flex items-center gap-2.5 rounded-full py-1 pr-3 pl-1">
            {profile.pictureUrl ? (
              <img src={profile.pictureUrl} alt="" className="size-9 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#43507F]/10 text-sm font-medium text-[#43507F]">
                {(profile.displayName ?? "?").trim().charAt(0).toUpperCase()}
              </span>
            )}
            <span className="max-w-[16ch] truncate text-sm font-medium text-ink">{profile.displayName}</span>
          </span>
        </div>
      </header>

      {/* One centred column: question, one line of help, the step itself, then
          a single action. */}
      <main className="flex flex-1 flex-col items-center justify-center px-5 py-8 text-center lg:px-12">
        <h1 className="text-2xl font-medium leading-tight text-ink lg:text-[2.5rem]">{heading.title}</h1>
        <p className="mt-3 max-w-[56ch] text-base leading-relaxed text-ink/50">{heading.body}</p>

        <div className="mt-10 flex w-full max-w-[900px] flex-col items-center text-left">
          {step === "bond" && (
            // A search field and a short result list — nothing more. The full
            // add-bond page (ratings, coupon overrides, the review card) is
            // where a user goes to be precise; on their first minute all they
            // need is the series and what they put in.
            <div className="flex w-full max-w-[560px] flex-col rounded-3xl border border-black/5 bg-white p-5 lg:p-6">
              <div className="flex items-center gap-3 rounded-2xl bg-black/[0.04] px-5 py-3.5 focus-within:bg-black/[0.06]">
                <IconSearch size={20} className="shrink-0 text-ink/40" />
                <input
                  autoFocus
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="ค้นหารหัสรุ่น เช่น ORI284C"
                  className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink/35"
                />
              </div>

              <div className="mt-3 max-h-[300px] overflow-y-auto">
                {term.trim().length < 2 ? (
                  <div className="flex flex-col items-center gap-4 py-6 text-center">
                    <img src={art.src} alt="" aria-hidden className="h-28 w-auto select-none object-contain" />
                    <p className="max-w-[38ch] text-sm leading-relaxed text-ink/45">
                      พิมพ์รหัสรุ่นหุ้นกู้ที่คุณถือ — ดูได้จากใบ 50 ทวิ หรือแอปโบรกเกอร์
                    </p>
                  </div>
                ) : results.length === 0 ? (
                  <p className="py-8 text-center text-sm text-ink/45">ไม่พบรุ่นนี้ในทะเบียน — ลองตรวจตัวสะกดอีกครั้ง</p>
                ) : (
                  <ul className="flex flex-col">
                    {results.map((c) => (
                      <li key={c.symbol}>
                        <button
                          onClick={() => setPicked(c)}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-black/5 ${
                            picked?.symbol === c.symbol ? "bg-[#43507F]/8" : ""
                          }`}
                        >
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-medium text-ink">{c.symbol}</span>
                            <span className="truncate text-xs text-ink/50">{c.issuer || c.nameTh}</span>
                          </span>
                          {c.couponRate != null && (
                            <span className="shrink-0 font-nunito text-sm text-ink/60">{c.couponRate}%</span>
                          )}
                          {picked?.symbol === c.symbol && <IconCheck size={18} className="shrink-0 text-[#43507F]" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* The one thing the catalog can't tell us. */}
              {picked && (
                <div className="mt-3 border-t border-black/5 pt-3">
                  <label className="text-sm text-ink/55" htmlFor="onboard-face">
                    มูลค่าที่ลงทุนใน {picked.symbol}
                  </label>
                  <div className="mt-2 flex items-center gap-2 rounded-2xl bg-black/[0.04] px-5 py-3.5 focus-within:bg-black/[0.06]">
                    <span className="shrink-0 text-lg text-ink/40">฿</span>
                    <input
                      id="onboard-face"
                      inputMode="numeric"
                      value={faceNum > 0 ? faceNum.toLocaleString("th-TH") : ""}
                      onChange={(e) => setFace(e.target.value)}
                      placeholder="เช่น 200,000"
                      className="min-w-0 flex-1 bg-transparent font-nunito text-lg text-ink outline-none"
                    />
                  </div>
                  {addError && <p className="mt-2 text-sm text-[#C0563B]">{addError}</p>}
                </div>
              )}

              {holdingCount + added.length > 0 && !picked && (
                <p className="mt-3 flex w-fit items-center gap-1.5 rounded-full bg-[#12BC59]/10 px-3.5 py-2 text-sm font-medium text-[#12BC59]">
                  <IconCheck size={16} /> เพิ่มแล้ว {holdingCount + added.length} รุ่น
                </p>
              )}
            </div>
          )}

          {step === "income" && (
            <div className="flex w-full max-w-[520px] flex-col items-center rounded-3xl border border-black/5 bg-white p-6 text-center lg:p-8">
              <img src={art.src} alt="" aria-hidden className="h-24 w-auto select-none object-contain" />
              <label className="mt-5 text-sm text-ink/55" htmlFor="onboard-income">
                รายได้ทั้งปีก่อนหักค่าใช้จ่าย
              </label>
              <div className="mt-2 flex w-full items-center gap-2 rounded-2xl bg-black/[0.04] px-5 py-4 focus-within:bg-black/[0.06]">
                <span className="shrink-0 text-lg text-ink/40">฿</span>
                <input
                  id="onboard-income"
                  autoFocus
                  inputMode="numeric"
                  value={incomeNum > 0 ? incomeNum.toLocaleString("th-TH") : ""}
                  onChange={(e) => setIncome(e.target.value)}
                  placeholder="เช่น 600,000"
                  className="min-w-0 flex-1 bg-transparent font-nunito text-xl text-ink outline-none"
                />
                <span className="shrink-0 text-sm text-ink/40">ต่อปี</span>
              </div>
              {rate !== null && (
                <p className="mt-3 text-sm text-ink/60">
                  ฐานภาษีของคุณคือ <span className="font-medium text-[#43507F]">{rate}%</span>
                  {rate < 15 && " — ต่ำกว่า 15% ที่ถูกหักไว้ ขอคืนส่วนต่างได้"}
                </p>
              )}
              {error && <p className="mt-3 text-sm text-[#C0563B]">{error}</p>}
            </div>
          )}

          {step === "done" && (
            <div className="flex w-full max-w-[520px] flex-col items-center rounded-3xl border border-black/5 bg-white p-6 text-center lg:p-8">
              <img src={art.src} alt="" aria-hidden className="h-28 w-auto select-none object-contain" />
              {refund > 0 ? (
                <>
                  <p className="mt-5 text-sm text-ink/55">ปีนี้คุณมีสิทธิ์ขอคืนประมาณ</p>
                  <p className="font-nunito text-4xl font-medium text-[#12BC59] lg:text-5xl">฿{fmt(refund)}</p>
                </>
              ) : (
                <p className="mt-5 max-w-[42ch] text-sm leading-relaxed text-ink/55">
                  ทุกครั้งที่ได้รับดอกเบี้ย ถ่ายรูปใบ 50 ทวิ ส่งเข้า LINE แล้ว beond เก็บให้อัตโนมัติ
                </p>
              )}
            </div>
          )}
        </div>

        <button
          onClick={primary.act}
          disabled={primary.disabled}
          className="mt-10 rounded-full bg-[#43507F] px-12 py-4 text-base font-medium text-white transition hover:bg-[#525F92] disabled:opacity-40"
        >
          {primary.label}
        </button>
        {i > 0 && (
          <button
            onClick={() => setI((n) => Math.max(0, n - 1))}
            className="mt-3 rounded-full px-4 py-2 text-sm text-ink/45 transition hover:bg-black/5"
          >
            ย้อนกลับ
          </button>
        )}

        {/* Progress reads as dots so it stays quiet under the action. */}
        <div className="mt-8 flex items-center gap-2">
          {STEPS.map((s, n) => (
            <span
              key={s.key}
              className={`size-1.5 rounded-full transition-colors ${n === i ? "bg-[#43507F]" : "bg-black/15"}`}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
