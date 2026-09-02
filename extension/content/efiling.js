// e-Filing helper panel (efiling.rd.go.th).
//
// Shows the 40(4) rows synced from the beond app beside the real form and fills
// them in — in one click ("กรอกทั้งหมด"), which is the whole point of the thing.
//
// The form is an Angular app with generated ids, so the boxes are found by
// their Thai captions instead of by selectors (content/autodetect.js). Two
// fallbacks sit behind that, because a filing is not a place to be clever and
// wrong: the user can teach the panel the four boxes by clicking them
// ("จับคู่ช่อง", stored per page path), and every value keeps a copy button that
// cannot break at all.

const STORAGE_KEY = "beond_bond_data";
const MAP_KEY = "beond_field_map";
const POS_KEY = "beond_panel_pos";
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
let toolsOpen = false; // the fallback tools are folded away until asked for
let detailsOpen = false; // the payer list sits behind "รายละเอียด"
let collapsed = false; // card shrunk to the avatar stack alone
let blocks = []; // auto-detected payer blocks, refreshed as the app renders
// Which payers this visit has written into the form. Kept per row index rather
// than per row object so a re-render of the panel cannot lose it, and cleared
// whenever the app syncs a different set of rows.
const filled = new Set();
let busy = false; // a fill is running; the panel says so instead of re-entering

chrome.storage.local.get([STORAGE_KEY, MAP_KEY, POS_KEY], (data) => {
  rows = data[STORAGE_KEY] ?? [];
  fieldMap = data[MAP_KEY] ?? {};
  if (data[POS_KEY]) applyPos(data[POS_KEY]);
  render();
});

// ── panel ──────────────────────────────────────────────────────────────────
const host = document.createElement("div");
host.id = "beond-efiling-panel";
document.documentElement.appendChild(host);

// ── where the panel sits ───────────────────────────────────────────────────
// The form has its own buttons down the right-hand side and along the bottom,
// and which ones depends on the page, so no fixed corner is safe. The panel
// starts against the right edge at mid-height — clear of both a site header and
// a bottom action bar — and can be dragged anywhere by its title bar, which is
// remembered for next time.

/** Pin the panel to a saved {x, y} in viewport pixels. */
function applyPos(pos) {
  const w = host.firstElementChild?.getBoundingClientRect().width || 300;
  const h = host.firstElementChild?.getBoundingClientRect().height || 200;
  const x = Math.min(Math.max(pos.x, 4), Math.max(4, innerWidth - w - 4));
  const y = Math.min(Math.max(pos.y, 4), Math.max(4, innerHeight - Math.min(h, 120) - 4));
  host.style.left = `${x}px`;
  host.style.top = `${y}px`;
  host.style.right = "auto";
  host.style.bottom = "auto";
  host.style.transform = "none";
}

/** Back to the default perch, and forget the saved spot. */
function resetPos() {
  host.style.cssText = "";
  chrome.storage.local.set({ [POS_KEY]: null });
}

/** Drag by the title bar. Buttons inside it keep working. */
function makeDraggable(handle) {
  handle.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    const box = host.firstElementChild.getBoundingClientRect();
    const dx = e.clientX - box.left;
    const dy = e.clientY - box.top;
    handle.setPointerCapture(e.pointerId);
    handle.classList.add("beond-dragging");

    const move = (ev) => applyPos({ x: ev.clientX - dx, y: ev.clientY - dy });
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.classList.remove("beond-dragging");
      const now = host.firstElementChild.getBoundingClientRect();
      chrome.storage.local.set({ [POS_KEY]: { x: now.left, y: now.top } });
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    e.preventDefault();
  });
  // A double-click on the bar puts it back where it started.
  handle.addEventListener("dblclick", (e) => {
    if (e.target.closest("button")) return;
    resetPos();
  });
}

/** Colour a payer's initial from its name, so the stack reads as distinct faces. */
const FACE_COLORS = ["#43507f", "#2968a5", "#779bc6", "#5f8bb0", "#3f6f9e"];
// Nearly every Thai issuer name opens with its company form, so the raw first
// letter would draw the same "บ" on every face. Drop the form first.
const COMPANY_PREFIX = /^(บมจ\.?|บจก\.?|บจ\.?|หจก\.?|บริษัท|ธนาคาร)\s*/;
function initialOf(name) {
  const bare = (name || "").trim().replace(COMPANY_PREFIX, "").trim();
  return (bare || name || "?").charAt(0).toUpperCase();
}
function faceFor(row, i) {
  const name = typeof row === "string" ? row : row?.issuer_name;
  const dot = el("span", "beond-face", initialOf(name));
  dot.style.background = FACE_COLORS[i % FACE_COLORS.length];
  dot.title = name || "";

  // The real logo when the app resolved one. It is loaded over the monogram,
  // never in place of it: this runs on someone else's page, whose CSP may block
  // the request outright, and a blank circle would be worse than a letter.
  const src = typeof row === "object" ? row?.logo_url : null;
  if (src) {
    const img = document.createElement("img");
    img.className = "beond-face-logo";
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.onload = () => {
      dot.textContent = "";
      dot.style.background = "#fff";
      dot.append(img);
    };
    img.src = src;
  }
  return dot;
}

function render() {
  const mapped = fieldMap[location.pathname] ?? {};
  const mappedCount = FIELDS.filter((f) => mapped[f.key]).length;
  // Same bar as auto-detection: an identity plus an amount. Requiring all four
  // would lock out the real form, which has no payer-name box to map.
  const mappedUsable =
    (mapped.issuer_name || mapped.issuer_tax_id) && (mapped.gross_interest || mapped.wht_amount);
  const canFill = blocks.length > 0 || Boolean(mappedUsable);
  const allDone = rows.length > 0 && filled.size >= rows.length;

  host.innerHTML = "";
  host.classList.toggle("beond-collapsed", collapsed);
  const panel = el("div", "beond-panel");

  // ── the card ────────────────────────────────────────────────────────────
  const card = el("div", "beond-card");
  card.title = "ลากเพื่อย้าย · ดับเบิลคลิกเพื่อคืนตำแหน่งเดิม";

  // Left: the payers themselves, up to four, then a count. Faces rather than an
  // icon because the question the user actually has is "whose figures?".
  const art = el("div", "beond-art");
  const stack = el("div", "beond-stack");
  const shown = rows.slice(0, 4);
  shown.forEach((r, i) => stack.append(faceFor(r, i)));
  if (rows.length > shown.length) {
    stack.append(el("span", "beond-face beond-face-more", `+${rows.length - shown.length}`));
  }
  if (rows.length === 0) stack.append(faceFor("b", 0));
  art.append(stack);
  card.append(art);

  const main = el("div", "beond-main");
  if (rows.length === 0) {
    main.append(el("h1", "beond-headline", "ยังไม่มีข้อมูลจาก beond"));
    main.append(el("p", "beond-sub", "เปิดแอป beond หน้า “สรุปประจำปี” แล้วกด “ส่งเข้า e-Filing”"));
  } else {
    main.append(
      el(
        "h1",
        "beond-headline",
        allDone ? `กรอกครบ ${rows.length} รายการแล้ว` : `พร้อมกรอกข้อมูล ${rows.length} รายการ`,
      ),
    );
    // The one line under the headline carries the problem when there is one:
    // an encouraging subtitle over a dead button is worse than no subtitle.
    main.append(
      el(
        "p",
        "beond-sub",
        canFill ? "ข้อมูลรายได้หุ้นกู้จากเว็ปไซต์ beond" : "ยังหาช่องกรอกในหน้านี้ไม่เจอ — เปิดรายละเอียดเพื่อจับคู่ช่องเอง",
      ),
    );
  }

  const actions = el("div", "beond-actions");
  if (rows.length > 0) {
    const all = el("button", "beond-primary", busy ? "กำลังกรอก…" : allDone ? "กรอกซ้ำ" : "กรอกเลย");
    all.disabled = busy || !canFill;
    all.title = canFill ? "กรอกทุกผู้จ่ายลงในแบบฟอร์ม" : "หาช่องกรอกไม่เจอ — เปิด “รายละเอียด” แล้วกด “จับคู่ช่องเอง”";
    all.onclick = () => fillAll(all);
    actions.append(all);
  }
  const detail = el("button", "beond-ghost", detailsOpen ? "ซ่อนรายละเอียด" : "รายละเอียด");
  detail.onclick = () => {
    detailsOpen = !detailsOpen;
    render();
  };
  actions.append(detail);
  main.append(actions);
  card.append(main);

  const collapse = el("button", "beond-icon-btn", collapsed ? "+" : "–");
  collapse.title = "ย่อ/ขยาย";
  collapse.onclick = () => {
    collapsed = !collapsed;
    render();
  };
  card.append(collapse);

  panel.append(card);
  makeDraggable(card);

  // ── details ─────────────────────────────────────────────────────────────
  if (detailsOpen) {
    const body = el("div", "beond-details");

    if (rows.length > 0) {
      const where = blocks.length
        ? `พบช่องกรอกในหน้านี้ ${blocks.length} ชุด`
        : mappedUsable
          ? `ใช้ช่องที่จับคู่ไว้ ${mappedCount} ช่อง`
          : "ยังหาช่องกรอกในหน้านี้ไม่เจอ";
      body.append(el("p", "beond-status", `${rows.length} ผู้จ่ายเงินได้ · ${where}`));

      rows.forEach((r, i) => {
        const isDone = filled.has(i);
        const row = el("div", `beond-row${isDone ? " beond-row-done" : ""}`);
        const name = el("div", "beond-row-name");
        // The tick is the answer to "did this one go in?", which the user is
        // otherwise left to verify by reading the form field by field.
        if (isDone) name.append(el("span", "beond-tick", "✓"));
        name.append(el("span", null, r.issuer_name || "—"));
        row.append(name);
        row.append(kv("เลขผู้เสียภาษี", fmtTaxId(r.issuer_tax_id), r.issuer_tax_id));
        row.append(kv("เงินได้", `฿${fmt(r.gross_interest)}`, String(r.gross_interest)));
        row.append(kv("ภาษีหัก ณ ที่จ่าย", `฿${fmt(r.wht_amount)}`, String(r.wht_amount)));

        const fill = el("button", "beond-fill", isDone ? "กรอกซ้ำ" : "กรอกแถวนี้");
        fill.type = "button";
        fill.disabled = busy || !canFill;
        fill.title = fill.disabled ? "หาช่องกรอกไม่เจอ" : "เขียนค่าของผู้จ่ายรายนี้ลงในฟอร์ม";
        fill.onclick = () => fillRow(r, fill, i);
        row.append(fill);
        body.append(row);
      });

      const total = rows.reduce((s, r) => s + r.wht_amount, 0);
      body.append(el("p", "beond-total", `รวมภาษีหัก ณ ที่จ่าย ฿${fmt(total)}`));
    }

    // The fallbacks live one fold deeper again. They matter on the day
    // detection misses, and a panel that leads with its own failure modes is a
    // panel nobody trusts.
    const more = el("button", "beond-more", toolsOpen ? "ซ่อนตัวช่วย" : "ตัวช่วยเพิ่มเติม");
    more.onclick = () => {
      toolsOpen = !toolsOpen;
      render();
    };
    body.append(more);

    if (toolsOpen || picking !== null) {
      const tools = el("div", "beond-tools");

      const mapBtn = el("button", "beond-map", picking === null ? "จับคู่ช่องเอง" : "ยกเลิกการจับคู่");
      mapBtn.title = "ใช้เมื่อกรอกอัตโนมัติไม่ติด: คลิกช่องในฟอร์มทีละช่อง";
      mapBtn.onclick = () => (picking === null ? startPicking() : stopPicking());
      tools.append(mapBtn);

      if (picking !== null) {
        tools.append(
          el(
            "p",
            "beond-hint",
            `คลิกช่อง “${FIELDS[picking].label}” ในฟอร์ม (${picking + 1}/${FIELDS.length}) · กด Esc ถ้าหน้านี้ไม่มีช่องนี้`,
          ),
        );
      }

      // What the page renders, and what the last fill did to it. Two halves of
      // the same question, and the only way to fix a miss from here.
      const dump = el("button", "beond-debug", "คัดลอกโครงสร้างฟอร์ม");
      dump.title = "ส่งให้ผู้พัฒนาเพื่อปรับการตรวจหาช่อง";
      dump.onclick = () => copyInto(dump, describeForm(), "คัดลอกโครงสร้างฟอร์ม");
      tools.append(dump);

      const log = el("button", "beond-debug", "คัดลอกบันทึกการกรอก");
      log.title = "ขั้นตอนล่าสุดของการกรอก — ส่งให้ผู้พัฒนาเมื่อกรอกไม่ครบ";
      log.onclick = () => copyInto(log, getTrace(), "คัดลอกบันทึกการกรอก");
      tools.append(log);

      body.append(tools);
    }

    panel.append(body);
  }

  host.append(panel);
}

/** Copy `text`, and say so on the button that asked for it. */
async function copyInto(btn, text, restore) {
  await navigator.clipboard.writeText(text);
  btn.textContent = "คัดลอกแล้ว";
  setTimeout(() => (btn.textContent = restore), 1600);
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
  document.addEventListener("keydown", onPickKey, true);
  render();
}

function stopPicking() {
  picking = null;
  document.removeEventListener("click", onPick, true);
  document.removeEventListener("keydown", onPickKey, true);
  render();
}

// Not every page has every box — the real 40(4) form has no payer-name field at
// all — so a field can be skipped instead of forcing a wrong click.
function onPickKey(e) {
  if (picking === null) return;
  if (e.key === "Escape") {
    e.preventDefault();
    advancePicking();
  }
}

function advancePicking() {
  picking += 1;
  if (picking >= FIELDS.length) stopPicking();
  else render();
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

  advancePicking();
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Write one payer into one detected block of inputs. */
function writeBlock(block, row) {
  let written = 0;
  for (const f of FIELDS) {
    const node = block[f.key];
    if (!node) continue;
    setValue(node, String(row[f.key]));
    written += 1;
  }
  return written;
}

/** Write one payer into the boxes the user mapped by hand. */
function writeMapped(row) {
  const map = fieldMap[location.pathname] ?? {};
  let written = 0;
  for (const f of FIELDS) {
    const node = map[f.key] ? document.querySelector(map[f.key]) : null;
    if (!node) continue;
    setValue(node, String(row[f.key]));
    written += 1;
  }
  return written;
}

/** Re-read the page until it has `want` blocks, or the wait runs out. */
async function waitForBlocks(want, ms = 1800) {
  const until = Date.now() + ms;
  for (;;) {
    const found = detectBlocks();
    if (found.length >= want || Date.now() > until) return found;
    await sleep(150);
  }
}

/**
 * Fill every payer in one click.
 *
 * One payer at a time: set that row's income type, write its figures, press the
 * card's own "เพิ่มรายการอื่น", repeat. Filling before adding
 * is deliberate — the form can refuse to grow while the row on screen is still
 * empty, and pressing a button that does nothing, repeatedly, is how a helper
 * turns into a mess.
 *
 * If the form will not grow, whatever fitted is left filled and the button says
 * how far it got — a partial fill the user can see beats a silent one they
 * cannot.
 */
async function fillAll(btn) {
  if (busy) return;
  busy = true;
  render();

  resetTrace();
  filled.clear();
  blocks = detectBlocks();
  trace({ step: "start", rows: rows.length, blocks: blocks.length });

  let done = 0;
  let stuck = false;
  for (let i = 0; i < rows.length; i += 1) {
    if (!blocks[i]) {
      // Ask the card this row belongs to, not the first card on the page.
      const add = findAddRowButton(blocks[i - 1]?.__row ?? blocks[0]?.__row ?? document);
      trace({ step: "add-row", row: i, button: add ? tidy(add.textContent).slice(0, 40) : null });
      if (!add) {
        stuck = true;
        break;
      }
      pressLikeAMouse(add);
      blocks = await waitForBlocks(i + 1);
      trace({ step: "after-add", row: i, blocks: blocks.length });
      if (!blocks[i]) {
        stuck = true;
        break;
      }
    }
    // Every payer carries its own income-type picker, including the rows just
    // added, and setting one re-renders the fields under it — so it is set per
    // row and the page re-read before anything is written into it.
    await chooseIncomeType(blocks[i].__row);
    blocks = detectBlocks();
    if (!blocks[i]) {
      trace({ step: "row-vanished", row: i, blocks: blocks.length });
      stuck = true;
      break;
    }
    const wrote = writeBlock(blocks[i], rows[i]);
    trace({ step: "write", row: i, fields: wrote });
    if (wrote > 0) {
      done += 1;
      filled.add(i);
    }
    await sleep(120); // let the row's change handlers settle before the next
  }

  // Nothing auto-detected: fall back to the hand-taught boxes, which can only
  // ever hold one payer at a time.
  if (done === 0 && rows.length) {
    await chooseIncomeType(document);
    done = writeMapped(rows[0]) > 0 ? 1 : 0;
  }

  busy = false;
  render();

  // Every payer went in — worth marking. Thrown from the panel so it reads as
  // the panel's doing, and only on a complete fill: a partial one is a job half
  // done, and celebrating it would be a lie.
  if (done === rows.length && done > 0) {
    const box = host.firstElementChild?.getBoundingClientRect();
    celebrate(box ? { x: box.left + box.width / 2, y: box.top + 40 } : null);
  }

  // Short on purpose: it replaces the button's own label for a moment, and a
  // longer sentence pushes the quiet button off the card.
  const label =
    done === rows.length
      ? `กรอกแล้ว ${done}`
      : stuck
        ? `กรอกได้ ${done}/${rows.length} · ติดขัด`
        : `กรอกได้ ${done}/${rows.length}`;
  const node = host.querySelector(".beond-primary");
  if (node) {
    node.textContent = label;
    setTimeout(render, 2600);
  }
  void btn;
}

/** Fill a single payer — into its own detected block, or the mapped boxes. */
async function fillRow(row, btn, index) {
  const block = blocks[index];
  await chooseIncomeType(block?.__row ?? document);
  const written = block ? writeBlock(block, row) : writeMapped(row);
  if (written) filled.add(index);
  btn.textContent = written ? "กรอกแล้ว" : "หาช่องไม่เจอ";
  setTimeout(render, 1600);
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

// ── keeping up with the app ────────────────────────────────────────────────
// The form is a single-page app: the boxes appear, disappear and move as the
// user navigates it. Re-scan when the DOM settles, and only redraw when the
// count actually changed, so the panel is never the thing causing a re-render
// storm.
let rescanTimer = null;
function scheduleRescan() {
  clearTimeout(rescanTimer);
  rescanTimer = setTimeout(() => {
    if (busy || picking !== null) return;
    const next = detectBlocks();
    const changed = next.length !== blocks.length;
    blocks = next;
    if (changed) render();
  }, 400);
}

new MutationObserver((records) => {
  // Ignore our own panel's mutations.
  for (const r of records) if (!host.contains(r.target)) return scheduleRescan();
}).observe(document.documentElement, { childList: true, subtree: true });

scheduleRescan();

// Keep the panel in step with a re-sync from the app while the tab stays open.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes[STORAGE_KEY]) {
    rows = changes[STORAGE_KEY].newValue ?? [];
    filled.clear(); // a fresh sync is a fresh set of payers; old ticks would lie
  }
  if (changes[MAP_KEY]) fieldMap = changes[MAP_KEY].newValue ?? {};
  render();
});
