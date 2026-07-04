import { useEffect, useState } from "react";
import { IconTrash, IconX } from "@tabler/icons-react";
import { supabase, supabaseEnabled } from "../lib/supabase";
import { notifyPortfolioChanged } from "../hooks/usePortfolio";

interface HoldingRow {
  id: string;
  face_value: number;
  bonds: { symbol: string; issuer: string } | null;
}

function formatTHB(v: number): string {
  return new Intl.NumberFormat("th-TH").format(v);
}

interface DebugPanelProps {
  open: boolean;
  onClose: () => void;
}

// Dev-only: list every holding and delete them individually. Deletes cascade
// to payouts; the page reloads on close if anything changed so the timeline
// and allocation refresh.
export default function DebugPanel({ open, onClose }: DebugPanelProps) {
  const [rows, setRows] = useState<HoldingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    if (!supabaseEnabled || !supabase) return;
    setLoading(true);
    const { data } = await supabase
      .from("holdings")
      .select("id, face_value, bonds(symbol, issuer)")
      .order("id");
    setRows((data as unknown as HoldingRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  if (!open) return null;

  const del = async (id: string) => {
    if (busy || !supabase) return;
    setBusy(id);
    const { error } = await supabase.from("holdings").delete().eq("id", id);
    setBusy(null);
    if (error) {
      alert(`ลบไม่สำเร็จ: ${error.message}`);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    notifyPortfolioChanged(); // live-refresh timeline + allocation
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-3xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#43507F]">Debug · ลบหุ้นกู้ที่ถือ</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100"
            aria-label="ปิด"
          >
            <IconX size={20} />
          </button>
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <p className="py-6 text-center text-sm text-black/40">กำลังโหลด...</p>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-black/40">ไม่มีหุ้นกู้ในพอร์ต</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[#E7E7E7] p-3"
                >
                  <div className="min-w-0">
                    <p className="font-nunito text-sm font-bold text-[#181D20]">
                      {r.bonds?.symbol ?? "—"}
                    </p>
                    <p className="truncate text-xs text-black/60">
                      {r.bonds?.issuer ?? "—"} · ฿
                      <span className="font-nunito">{formatTHB(r.face_value)}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => del(r.id)}
                    disabled={busy === r.id}
                    className="rounded-xl p-2 text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50"
                    title="ลบ"
                    aria-label="ลบ"
                  >
                    <IconTrash size={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-3 text-xs text-black/40">
          ลบแล้ว payouts จะถูกลบตาม · timeline อัปเดตทันที
        </p>
      </div>
    </div>
  );
}
