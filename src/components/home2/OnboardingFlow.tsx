import { useEffect, useMemo, useState } from "react";
import {
  IconAlertCircleFilled,
  IconArrowLeft,
  IconCheck,
  IconCircleCheckFilled,
  IconSearch,
} from "@tabler/icons-react";
import { ensureCatalog, searchLocal, type BondCandidate } from "../../lib/secApi";
import { createBondHolding } from "../../lib/holdings";
import { supabase } from "../../lib/supabase";
import {
  PERSONAL_ALLOWANCE,
  getAnnualIncome,
  marginalRateForIncome,
  saveAnnualIncome,
  saveMarginalRate,
} from "../../lib/taxSettings";
import { notifyPortfolioChanged } from "../../hooks/usePortfolio";
import addBondArt from "../../assets/add-bond-main.png";
import moneyArt from "../../assets/landing-money-bill.svg";

interface Props {
  /** Bonds already in the portfolio — the add step is satisfied once > 0. */
  holdingCount: number;
}

type StepKey = "bond" | "income";

const HEADING: Record<StepKey, { title: string; body: string }> = {
  bond: {
    title: "เพิ่มหุ้นกู้ที่คุณถือ",
    body: "ค้นหาด้วยรหัสรุ่น เช่น ORI284C แล้วใส่มูลค่าที่ลงทุน — beond จะสร้างปฏิทินดอกเบี้ยทั้งปีให้เอง",
  },
  income: {
    title: "รายได้ต่อปีของคุณ",
    body: "ใช้คำนวณว่าคุณอยู่ฐานภาษีไหน และขอคืนได้เท่าไหร่ — เก็บไว้ในบัญชีคุณเท่านั้น",
  },
};

/** One illustration per step, shown on its hub card and inside the step. */
const STEP_ART: Record<StepKey, string> = {
  bond: addBondArt,
  income: moneyArt,
};

/**
 * A single task on the hub.
 *
 * Three states, and the state is what the eye lands on first: a coloured status
 * dot with its word above the task's name, the way a setup checklist reads when
 * you come back to it a second time and only want to know what is left. Done
 * tasks keep a quiet "แก้ไข" link rather than a button — they are finished, and
 * a second primary button would compete with the one thing still to do.
 */
function TaskCard({
  state,
  title,
  art,
  action,
  onAction,
}: {
  state: "todo" | "done";
  title: string;
  art: string;
  action: string;
  onAction?: () => void;
}) {
  const status =
    state === "done"
      ? { label: "เรียบร้อย", tone: "text-[#12BC59]", icon: <IconCircleCheckFilled size={18} /> }
      : { label: "ต้องทำ", tone: "text-[#E8A33D]", icon: <IconAlertCircleFilled size={18} /> };

  return (
    <div className="flex flex-col rounded-3xl border border-black/8 bg-white p-6 text-left">
      <span className={`flex items-center gap-2 text-xs font-medium tracking-wide ${status.tone}`}>
        {status.icon}
        {status.label}
      </span>
      <h2 className="mt-3 text-lg leading-snug font-medium text-ink">{title}</h2>

      {state === "done" ? (
        <button
          onClick={onAction}
          className="mt-1 w-fit rounded-full text-sm text-[#2968A5] transition hover:bg-black/5"
        >
          {action}
        </button>
      ) : (
        <p className="mt-1 text-sm text-ink/40">จำเป็น</p>
      )}

      {/* The illustration sits between the label and the action, and takes the
          slack — so the three cards line their buttons up even when their text
          runs to different lengths. */}
      <div className="flex flex-1 items-center justify-center py-6">
        <img src={art} alt="" aria-hidden className="h-28 w-auto max-w-full select-none object-contain" />
      </div>

      {state !== "done" && (
        <button
          onClick={onAction}
          className="w-full rounded-full bg-[#43507F] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#525F92]"
        >
          {action}
        </button>
      )}
    </div>
  );
}

/**
 * First-run onboarding — straight to the two inputs beond can't work without,
 * a portfolio and an income, then the payoff. No teaching slides: the user came
 * to set the account up, not to read.
 *
 * The shape is a hub, not a wizard: one screen lists the tasks with their state,
 * and opening one swaps in that task's own screen. A wizard insists on an order
 * and hides how much is left; a hub survives the user leaving halfway and coming
 * back, which on a first run is the normal case rather than the exception.
 *
 * Rendered inside the dashboard's main column, so it brings no chrome of its
 * own — the sidebar, brand and profile stay put around it. A first-run user
 * needs to see where they have landed, not a separate full-screen detour that
 * hides the app until they are finished with it.
 */
export default function OnboardingFlow({ holdingCount }: Props) {
  const [view, setView] = useState<"hub" | StepKey>("hub");
  const [term, setTerm] = useState("");
  const [picked, setPicked] = useState<BondCandidate | null>(null);
  const [face, setFace] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  /** Series added during this flow — holdingCount is a snapshot from the page. */
  const [added, setAdded] = useState<string[]>([]);
  const [income, setIncome] = useState("");
  /** Income already on the account, so a returning user sees the task ticked. */
  const [savedIncome, setSavedIncome] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The catalog is a local file; searching it is instant and offline.
  useEffect(() => { ensureCatalog(); }, []);
  useEffect(() => {
    let live = true;
    getAnnualIncome().then((n) => {
      if (!live || n == null) return;
      setSavedIncome(n);
      setIncome(String(n));
    });
    return () => { live = false; };
  }, []);
  const results = useMemo(() => searchLocal(term).slice(0, 8), [term]);

  const incomeNum = Number(income.replace(/[^\d]/g, ""));
  const rate = incomeNum > 0 ? marginalRateForIncome(Math.max(0, incomeNum - PERSONAL_ALLOWANCE)) : null;

  const faceNum = Number(face.replace(/[^\d]/g, ""));
  const bonds = holdingCount + added.length;
  const bondDone = bonds > 0;
  const incomeDone = savedIncome != null && savedIncome > 0;

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
    setSavedIncome(incomeNum);
    notifyPortfolioChanged();
    setView("hub");
  };

  if (view === "hub") {
    return (
      <section className="flex h-full w-full flex-col items-center overflow-y-auto py-6 lg:py-10">
          <h1 className="text-center text-2xl leading-tight font-medium text-ink lg:text-[2.5rem]">
            มาตั้งค่าบัญชีของคุณ
          </h1>
          <p className="mt-3 max-w-[56ch] text-center text-base leading-relaxed text-ink/50">
            ทำสองขั้นนี้ให้ครบ แล้ว beond จะบอกได้ว่าปีนี้คุณขอคืนภาษีได้เท่าไหร่
          </p>

          <div className="mt-10 grid w-full max-w-[760px] gap-5 lg:grid-cols-2">
            <TaskCard
              state={bondDone ? "done" : "todo"}
              title={bondDone ? `เพิ่มแล้ว ${bonds} รุ่น` : "เพิ่มหุ้นกู้ที่คุณถือ"}
              art={STEP_ART.bond}
              action={bondDone ? "เพิ่มอีกรุ่น" : "เพิ่มหุ้นกู้"}
              onAction={() => setView("bond")}
            />
            <TaskCard
              state={incomeDone ? "done" : "todo"}
              title={
                incomeDone ? `ฐานภาษี ${marginalRateForIncome(Math.max(0, (savedIncome ?? 0) - PERSONAL_ALLOWANCE))}%` : "ระบุรายได้ต่อปี"
              }
              art={STEP_ART.income}
              action={incomeDone ? "แก้ไข" : "ระบุรายได้"}
              onAction={() => setView("income")}
            />
        </div>
      </section>
    );
  }

  const heading = HEADING[view];
  const primary =
    view === "bond"
      ? picked
        ? { label: adding ? "กำลังเพิ่ม…" : "เพิ่มเข้าพอร์ต", act: addBond, disabled: !faceNum || adding }
        : { label: "เสร็จแล้ว", act: () => setView("hub"), disabled: false }
      : { label: saving ? "กำลังบันทึก…" : "บันทึก", act: saveIncome, disabled: !incomeNum || saving };

  return (
    // One centred column: question, one line of help, the step itself, then a
    // single action.
    <section className="flex h-full w-full flex-col items-center justify-center overflow-y-auto py-6 text-center lg:py-10">
        <h1 className="text-2xl leading-tight font-medium text-ink lg:text-[2.5rem]">{heading.title}</h1>
        <p className="mt-3 max-w-[56ch] text-base leading-relaxed text-ink/50">{heading.body}</p>

        <div className="mt-10 flex w-full max-w-[900px] flex-col items-center text-left">
          {view === "bond" && (
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
                    <img src={STEP_ART.bond} alt="" aria-hidden className="h-28 w-auto select-none object-contain" />
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
                            <span className="font-nunito shrink-0 text-sm text-ink/60">{c.couponRate}%</span>
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
                      className="font-nunito min-w-0 flex-1 bg-transparent text-lg text-ink outline-none"
                    />
                  </div>
                  {addError && <p className="mt-2 text-sm text-[#C0563B]">{addError}</p>}
                </div>
              )}

              {bonds > 0 && !picked && (
                <p className="mt-3 flex w-fit items-center gap-1.5 rounded-full bg-[#12BC59]/10 px-3.5 py-2 text-sm font-medium text-[#12BC59]">
                  <IconCheck size={16} /> เพิ่มแล้ว {bonds} รุ่น
                </p>
              )}
            </div>
          )}

          {view === "income" && (
            <div className="flex w-full max-w-[520px] flex-col items-center rounded-3xl border border-black/5 bg-white p-6 text-center lg:p-8">
              <img src={STEP_ART.income} alt="" aria-hidden className="h-24 w-auto select-none object-contain" />
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
                  className="font-nunito min-w-0 flex-1 bg-transparent text-xl text-ink outline-none"
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

        </div>

        <button
          onClick={primary.act}
          disabled={primary.disabled}
          className="mt-10 rounded-full bg-[#43507F] px-12 py-4 text-base font-medium text-white transition hover:bg-[#525F92] disabled:opacity-40"
        >
          {primary.label}
        </button>
        <button
          onClick={() => setView("hub")}
          className="mt-3 flex items-center gap-1.5 rounded-full px-4 py-2 text-sm text-ink/45 transition hover:bg-black/5"
        >
          <IconArrowLeft size={16} /> กลับไปหน้าตั้งค่า
        </button>
    </section>
  );
}
