// e-Filing helper panel (efiling.rd.go.th).
//
// Shows the 40(4) rows synced from the beond app beside the real form and fills
// them in. The RD form is not a public, stable DOM — it changes between tax
// years and between the หน้ารายการ / หน้าแก้ไข layouts — so instead of shipping
// brittle selectors, the user teaches the panel once ("จับคู่ช่อง"): click the
// four fields in order and the mapping is stored per page path. Autofill then
// writes into the mapped fields, and every value stays copyable by hand as a
// fallback that can never break.

const STORAGE_KEY = "beond_bond_data";
const MAP_KEY = "beond_field_map";
const FIELDS = [
  { key: "issuer_name", label: "ชื่อผู้จ่ายเงินได้" },
  { key: "issuer_tax_id", label: "เลขประจำตัวผู้เสียภาษีผู้จ่าย" },
  { key: "gross_interest", label: "จำนวนเงินได้" },
  { key: "wht_amount", label: "ภาษีหัก ณ ที่จ่าย" },
];

const fmt = (n) => new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const fmtTaxId = (d) => `${d[0]}-${d.slice(1, 5)}-${d.slice(5, 10)}-${d.slice(10, 12)}-${d[12]}`;

let rows = [];
let fieldMap = {}; // { [pathname]: { issuer_name: selector, … } }
let picking = null; // index into FIELDS while in "จับคู่ช่อง" mode

chrome.storage.local.get([STORAGE_KEY, MAP_KEY], (data) => {
  rows = data[STORAGE_KEY] ?? [];
  fieldMap = data[MAP_KEY] ?? {};
  render();
});

// ── panel ──────────────────────────────────────────────────────────────────
const host = document.createElement("div");
host.id = "beond-efiling-panel";
document.documentElement.appendChild(host);

function render() {
  const mapped = fieldMap[location.pathname] ?? {};
  const mappedCount = FIELDS.filter((f) => mapped[f.key]).length;

  host.innerHTML = "";
  const panel = el("div", "beond-panel");

  const head = el("div", "beond-head");
  head.append(el("span", "beond-title", "beond · 40(4)"));
  const collapse = el("button", "beond-icon-btn", "–");
  collapse.title = "ย่อ/ขยาย";
  collapse.onclick = () => panel.classList.toggle("beond-collapsed");
  head.append(collapse);
  panel.append(head);

  const body = el("div", "beond-body");

  if (rows.length === 0) {
    body.append(el("p", "beond-empty", "ยังไม่มีข้อมูล — เปิดแอป beond หน้า “สรุปประจำปี” แล้วกด “ส่งเข้า e-Filing”"));
  } else {
    const status = el(
      "p",
      "beond-status",
      mappedCount === FIELDS.length
        ? `จับคู่ช่องแล้ว · ${rows.length} ผู้จ่ายเงินได้`
        : `${rows.length} ผู้จ่ายเงินได้ · ยังไม่ได้จับคู่ช่อง (${mappedCount}/${FIELDS.length})`,
    );
    body.append(status);

    rows.forEach((r, i) => {
      const card = el("div", "beond-row");
      card.append(el("div", "beond-row-name", r.issuer_name || "—"));
      card.append(kv("เลขผู้เสียภาษี", fmtTaxId(r.issuer_tax_id), r.issuer_tax_id));
      card.append(kv("เงินได้", `฿${fmt(r.gross_interest)}`, String(r.gross_interest)));
      card.append(kv("ภาษีหัก ณ ที่จ่าย", `฿${fmt(r.wht_amount)}`, String(r.wht_amount)));

      const fill = el("button", "beond-fill", "กรอกแถวนี้");
      fill.disabled = mappedCount !== FIELDS.length;
      fill.title = fill.disabled ? "จับคู่ช่องก่อน" : "เขียนค่าลงช่องที่จับคู่ไว้";
      fill.onclick = () => fillRow(r, fill);
      card.append(fill);
      body.append(card);
    });

    const total = rows.reduce((s, r) => s + r.wht_amount, 0);
    body.append(el("p", "beond-total", `รวมภาษีหัก ณ ที่จ่าย ฿${fmt(total)}`));
  }

  const mapBtn = el("button", "beond-map", picking === null ? "จับคู่ช่อง" : "ยกเลิกการจับคู่");
  mapBtn.onclick = () => (picking === null ? startPicking() : stopPicking());
  body.append(mapBtn);

  if (picking !== null) {
    body.append(el("p", "beond-hint", `คลิกช่อง “${FIELDS[picking].label}” ในฟอร์ม (${picking + 1}/${FIELDS.length})`));
  }

  panel.append(body);
  host.append(panel);
}

function kv(label, shown, copyValue) {
  const row = el("div", "beond-kv");
  row.append(el("span", "beond-k", label));
  row.append(el("span", "beond-v", shown));
  const copy = el("button", "beond-copy", "คัดลอก");
  copy.onclick = async () => {
    await navigator.clipboard.writeText(copyValue);
    copy.textContent = "คัดลอกแล้ว";
    setTimeout(() => (copy.textContent = "คัดลอก"), 1200);
  };
  row.append(copy);
  return row;
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

// ── field mapping ──────────────────────────────────────────────────────────
function startPicking() {
  picking = 0;
  document.addEventListener("click", onPick, true);
  render();
}

function stopPicking() {
  picking = null;
  document.removeEventListener("click", onPick, true);
  render();
}

function onPick(e) {
  if (host.contains(e.target)) return; // clicks inside our own panel
  const input = e.target.closest("input, textarea, select");
  if (!input) return;
  e.preventDefault();
  e.stopPropagation();

  const map = fieldMap[location.pathname] ?? {};
  map[FIELDS[picking].key] = selectorFor(input);
  fieldMap[location.pathname] = map;
  chrome.storage.local.set({ [MAP_KEY]: fieldMap });

  picking += 1;
  if (picking >= FIELDS.length) stopPicking();
  else render();
}

// A selector stable enough to survive a reload: prefer id, then name, then a
// nth-of-type path. Ids on this form are generated per render in places, so the
// mapping is per pathname and re-teachable in a few clicks when it drifts.
function selectorFor(node) {
  if (node.id) return `#${CSS.escape(node.id)}`;
  if (node.name) return `${node.tagName.toLowerCase()}[name="${CSS.escape(node.name)}"]`;
  const parts = [];
  let cur = node;
  while (cur && cur.nodeType === 1 && parts.length < 6) {
    const tag = cur.tagName.toLowerCase();
    if (cur.id) {
      parts.unshift(`#${CSS.escape(cur.id)}`);
      break;
    }
    const sibs = [...(cur.parentElement?.children ?? [])].filter((c) => c.tagName === cur.tagName);
    parts.unshift(sibs.length > 1 ? `${tag}:nth-of-type(${sibs.indexOf(cur) + 1})` : tag);
    cur = cur.parentElement;
  }
  return parts.join(" > ");
}

// ── filling ────────────────────────────────────────────────────────────────
function fillRow(row, btn) {
  const map = fieldMap[location.pathname] ?? {};
  let missing = 0;
  for (const f of FIELDS) {
    const node = map[f.key] ? document.querySelector(map[f.key]) : null;
    if (!node) {
      missing += 1;
      continue;
    }
    setValue(node, String(row[f.key]));
  }
  btn.textContent = missing ? `หาไม่เจอ ${missing} ช่อง` : "กรอกแล้ว";
  setTimeout(() => (btn.textContent = "กรอกแถวนี้"), 1600);
}

// Write through the native setter, then fire input+change: the form is a
// framework-controlled app, and assigning .value alone leaves its internal
// state (and therefore what gets submitted) on the old value.
function setValue(node, value) {
  const proto = node instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  node.focus();
  if (setter) setter.call(node, value);
  else node.value = value;
  node.dispatchEvent(new Event("input", { bubbles: true }));
  node.dispatchEvent(new Event("change", { bubbles: true }));
  node.blur();
}

// Keep the panel in step with a re-sync from the app while the tab stays open.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes[STORAGE_KEY]) rows = changes[STORAGE_KEY].newValue ?? [];
  if (changes[MAP_KEY]) fieldMap = changes[MAP_KEY].newValue ?? {};
  render();
});
