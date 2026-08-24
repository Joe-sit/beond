import taxidError from "../assets/badges/taxid-error.svg";

interface Props {
  /** The 13-digit id as it was read, formatted for display (or null when absent). */
  readValue: string | null;
  /** Digits only — a length other than 13 means the id is incomplete. */
  digits: string;
  /**
   * DBD lookup result for `digits`: the official company name, `null` when the
   * id isn't registered, `undefined` while the lookup hasn't resolved.
   */
  liveName: string | null | undefined;
  onClose: () => void;
}

/**
 * Payer-tax-id mismatch bottom sheet — blocks saving until the number matches the
 * bond's company (Figma 1287:4348). Lives in its own file so the debug route
 * (`?sheet`) renders the exact markup the scan flow does.
 */
export default function TaxIdErrorSheet({ readValue, digits, liveName, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[130] flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      {/* The illustration overhangs the sheet's top edge onto the dimmed
          backdrop. It is 13rem tall and sits 6rem above the edge, so 7rem of it
          falls inside — pt-32 (8rem) clears that with room to spare. Change one,
          change the other. */}
      <div
        className="relative flex flex-col items-center rounded-t-3xl bg-white px-8 pt-32 pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={taxidError}
          alt=""
          className="pointer-events-none absolute -top-24 left-1/2 h-52 w-auto -translate-x-1/2 select-none"
        />
        <p className="text-center text-xl font-bold text-[#1B1C1D]">
          เลขประจำตัวผู้เสียภาษีของผู้จ่ายไม่ถูกต้อง
        </p>
        <p className="mt-2 text-center text-base leading-relaxed text-black/60">
          กรุณาตรวจสอบหมายเลขจากเอกสาร<br />หรือส่งรูปภาพสลิปใหม่ในแชท
        </p>
        {/* Reason + the value that was read */}
        <p className="mt-5 w-full text-right text-sm text-black/60">
          {digits.length !== 13
            ? "เลขไม่ครบ 13 หลัก"
            : liveName === null
              ? "ไม่พบหมายเลขประจำตัวนี้"
              : `จดทะเบียนในชื่อ “${liveName}”`}
        </p>
        <div className="mt-1 flex w-full items-center justify-between rounded-2xl bg-black/5 px-4 py-2">
          <span className="text-base font-medium text-[#1B1C1D]">ค่าที่อ่านได้</span>
          <span className="font-nunito text-base text-black/60">{readValue ?? "-"}</span>
        </div>
        <button
          onClick={onClose}
          className="mt-6 h-14 w-full rounded-2xl bg-[#E0E6E9] text-base font-bold text-[#006AAA]"
        >
          รับทราบ
        </button>
      </div>
    </div>
  );
}
