// Read-only view of what the app last synced, so the user can confirm the
// extension actually received the year's rows before opening e-Filing.

const fmt = (n) =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const fmtTaxId = (d) => `${d[0]}-${d.slice(1, 5)}-${d.slice(5, 10)}-${d.slice(10, 12)}-${d[12]}`;

chrome.storage.local.get(["beond_bond_data", "beond_synced_at"], (data) => {
  const rows = data.beond_bond_data ?? [];
  const status = document.getElementById("status");
  const list = document.getElementById("rows");

  if (rows.length === 0) {
    status.textContent = "ยังไม่มีข้อมูล — เปิดแอป beond หน้า “สรุปประจำปี” แล้วกด “ส่งเข้า e-Filing”";
    return;
  }

  const when = data.beond_synced_at
    ? new Date(data.beond_synced_at).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })
    : "—";
  status.textContent = `${rows.length} ผู้จ่ายเงินได้ · ซิงก์เมื่อ ${when}`;

  for (const r of rows) {
    const card = document.createElement("div");
    card.className = "row";

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = r.issuer_name || "—";
    card.append(name);

    for (const [k, v] of [
      ["เลขผู้เสียภาษี", fmtTaxId(r.issuer_tax_id)],
      ["เงินได้", `฿${fmt(r.gross_interest)}`],
      ["ภาษีหัก ณ ที่จ่าย", `฿${fmt(r.wht_amount)}`],
    ]) {
      const line = document.createElement("div");
      line.className = "kv";
      const key = document.createElement("span");
      key.textContent = k;
      const val = document.createElement("span");
      val.className = "v";
      val.textContent = v;
      line.append(key, val);
      card.append(line);
    }
    list.append(card);
  }

  const total = document.createElement("p");
  total.className = "total";
  total.textContent = `รวมภาษีหัก ณ ที่จ่าย ฿${fmt(rows.reduce((s, r) => s + r.wht_amount, 0))}`;
  list.append(total);
});
