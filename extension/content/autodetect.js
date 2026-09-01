// Find the 40(4) input boxes on the e-Filing form without being told where
// they are.
//
// The form is an Angular app whose ids and DOM shape are generated — on the
// real page the inputs carry no id, no name, no placeholder and no aria-label,
// so a list of selectors would be both unwritable and rotting. What does NOT
// change is what the form says to the person filling it: every box is captioned
// in Thai, and the captions are prescribed by the return itself. So the boxes
// are found the way a human finds them — by reading the words around them.
//
// Two tiers, because the real page turned out to caption its fields only
// collectively: an input's OWN caption (its label, placeholder, aria-label…)
// names one field and is trusted outright; failing that, the surrounding block
// often names ALL of the row's fields at once — "เงินได้ทั้งหมด โปรดกรอก ภาษีหัก
// ณ ที่จ่าย โปรดกรอก เลขผู้จ่ายเงินได้ โปรดกรอก" — in the same order the boxes
// appear. That ordering is the signal: a run of N unlabelled inputs sharing a
// block that names N fields is matched up position by position.
//
// Everything here is read-only guessing; writing is the caller's job, and the
// user still confirms what happened. When a guess comes up empty the panel
// falls back to the manual "จับคู่ช่อง" mapping, which cannot break.

/* exported detectBlocks, findAddRowButton, pressLikeAMouse, chooseIncomeType, describeForm, trace, getTrace, resetTrace */

/** What each of the four values is captioned as. */
const FIELD_PATTERNS = {
  // Both of these captions contain "ผู้จ่ายเงินได้"; the overlap is resolved by
  // position and length in `keysInOrder`, not by the order of this object.
  issuer_tax_id: [
    /เลข(ประจำตัว)?(ผู้เสียภาษี|ผู้จ่าย)[^\s]*/,
    /เลขประจำตัวผู้เสียภาษีอากร/,
    /tax\s*?payer\s*?id/i,
    /tax\s*id/i,
  ],
  issuer_name: [/ชื่อผู้จ่าย(เงินได้)?/, /ผู้จ่ายเงินได้/, /payer\s*?name/i, /issuer\s*?name/i],
  gross_interest: [/เงินได้ทั้งหมด/, /จำนวนเงินได้/, /เงินได้ที่จ่าย/, /จำนวนเงินที่จ่าย/, /เงินได้ทั้งสิ้น/, /income\s*?amt/i],
  wht_amount: [/ภาษีหัก\s*ณ\s*ที่จ่าย/, /ภาษีที่หัก[^\s]*/, /ภาษีที่ถูกหัก/, /จำนวนภาษี/, /wht\s*?amt/i],
};
const FIELD_KEYS = ["issuer_name", "issuer_tax_id", "gross_interest", "wht_amount"];

/**
 * Each payer row also carries a "ประเภทเงินได้ / ประเภทธุรกิจ" dropdown, and the
 * figures beond holds are always the one option:
 *
 *   "ดอกเบี้ย (เฉพาะที่ไม่เลือกเสียภาษีในอัตราร้อยละ 15.0)/เงินเทียบเท่าเงินปันผลจาก THAI NVDR"
 *
 * The wording drifts between tax years, so the option is scored rather than
 * matched whole: the distinctive parts are the 15% opt-out and NVDR, and a
 * plain "ดอกเบี้ย" on its own is not enough to pick one.
 */
function optionScore(text) {
  let score = 0;
  if (/ไม่เลือกเสียภาษี/.test(text)) score += 2;
  if (/ร้อยละ\s*15|15\.0|15%/.test(text)) score += 1;
  if (/NVDR/i.test(text)) score += 2;
  if (/ดอกเบี้ย/.test(text)) score += 1;
  return score;
}
const TYPE_MIN_SCORE = 3;

/** Buttons that add another payer row, in the wording the form is likely to use. */
const ADD_ROW_PATTERNS = [/เพิ่มรายการ/, /เพิ่มผู้จ่าย/, /เพิ่มข้อมูล/, /^\s*เพิ่ม\s*$/];

const tidy = (s) => (s ?? "").replace(/\s+/g, " ").trim();
// Named `pause`, not `sleep`: content scripts in one entry share a scope, and
// efiling.js already declares `sleep`.
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// A record of what the last fill actually did. The form cannot be inspected
// from here, so when a fill misbehaves this is the only way to learn where it
// went wrong — captions and control labels only, never a typed value.
let traceLog = [];
function trace(entry) {
  traceLog.push(entry);
  if (traceLog.length > 300) traceLog.shift();
}
function resetTrace() {
  traceLog = [];
}
function getTrace() {
  return JSON.stringify({ url: location.pathname, steps: traceLog }, null, 1);
}

/** How an element would be recognised in a bug report. */
function describeNode(node) {
  if (!node) return null;
  return {
    tag: node.tagName.toLowerCase(),
    cls: tidy(typeof node.className === "string" ? node.className : "").slice(0, 60),
    text: tidy(node.textContent).slice(0, 60),
  };
}

/**
 * Every field name mentioned in `text`, in the order it is mentioned.
 *
 * Matches are collected across all four keys and then resolved greedily by
 * position, longest first, discarding anything that overlaps a match already
 * kept — which is how "เลขผู้จ่ายเงินได้" wins over the "ผู้จ่ายเงินได้" sitting
 * inside it rather than the two being counted as separate fields.
 */
function keysInOrder(text) {
  if (!text) return [];
  const hits = [];
  for (const key of FIELD_KEYS) {
    for (const re of FIELD_PATTERNS[key]) {
      const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
      let m;
      while ((m = g.exec(text)) !== null) {
        hits.push({ key, start: m.index, end: m.index + m[0].length });
        if (m[0].length === 0) g.lastIndex += 1;
      }
    }
  }
  hits.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

  const kept = [];
  for (const hit of hits) {
    if (kept.some((k) => hit.start < k.end && k.start < hit.end)) continue;
    kept.push(hit);
  }
  kept.sort((a, b) => a.start - b.start);
  return kept.map((h) => h.key);
}

/** The caption belonging to this input alone, if the page gives it one. */
function ownCaption(input) {
  const bits = [];
  const push = (s) => {
    const t = tidy(s);
    if (t && t.length <= 120) bits.push(t);
  };

  push(input.getAttribute("aria-label"));
  push(input.getAttribute("placeholder"));
  push(input.getAttribute("name"));
  push(input.getAttribute("formcontrolname"));

  const labelledBy = input.getAttribute("aria-labelledby");
  if (labelledBy) {
    for (const id of labelledBy.split(/\s+/)) push(document.getElementById(id)?.textContent);
  }
  if (input.id) {
    for (const l of document.querySelectorAll(`label[for="${CSS.escape(input.id)}"]`)) push(l.textContent);
  }
  const own = input.closest("label");
  if (own) push(own.textContent);


  // A caption rendered as a sibling: <label>…</label><input> or
  // <span class=…>…</span><input>, which is what a hand-rolled form does.
  const prev = input.previousElementSibling;
  if (prev && !prev.querySelector("input, textarea, select")) push(prev.textContent);

  // The same words often arrive twice — a <label for> that is also the previous
  // sibling — and a caption naming one field twice must not read as two.
  return [...new Set(bits)].join(" · ");
}

/**
 * The text of the smallest block that contains this input and something to
 * read — the field wrapper, the table cell plus its column header, or a few
 * levels of plain ancestors. On the real form this is where the row's shared
 * validation summary lives, and with it the field names in order.
 */
function blockCaption(input) {
  const bits = [];
  const push = (s) => {
    const t = tidy(s);
    if (t && t.length <= 400) bits.push(t);
  };

  // Which element the text came from matters as much as the text: two inputs
  // are part of one row only if one and the same element captions them both.
  let source = null;
  let node = input.parentElement;
  for (let depth = 0; node && depth < 5; depth += 1, node = node.parentElement) {
    if (node.matches?.("mat-form-field, .mat-form-field, .form-group, .field, td, th, li, .row")) {
      source = node;
      push(node.textContent);
      break;
    }
  }
  if (!source && input.parentElement) {
    source = input.parentElement;
    push(source.textContent);
  }

  const cell = input.closest("td");
  if (cell) {
    const row = cell.closest("tr");
    const idx = row ? [...row.children].indexOf(cell) : -1;
    const header = cell.closest("table")?.querySelector("thead tr");
    if (header && idx >= 0) push(header.children[idx]?.textContent);
  }

  return { text: bits.join(" · "), source };
}

/** Is this something a value can be typed into, and can the user see it? */
function isFillable(input) {
  if (input.type === "hidden" || input.disabled || input.readOnly) return null;
  if (!["text", "number", "tel", "search", ""].includes(input.type ?? "")) return false;
  const box = input.getBoundingClientRect();
  return box.width >= 24 && box.height >= 8; // laid out but not shown
}

/**
 * Every fillable input on the page with the field key it most likely holds,
 * in document order. `key` is null where nothing could be decided.
 */
function scanInputs(root = document) {
  const items = [];
  for (const input of root.querySelectorAll("input, textarea")) {
    if (!isFillable(input)) continue;
    const own = ownCaption(input);
    const { text: block, source } = blockCaption(input);
    const ownKeys = keysInOrder(own);
    items.push({
      input,
      own,
      block,
      source,
      // An own caption naming exactly one field settles it; naming several means
      // it is a shared blob like the block one, and is left to the run pass.
      key: new Set(ownKeys).size === 1 ? ownKeys[0] : null,
      sig: keysInOrder(own.length > block.length ? own : block),
    });
  }

  // Undecided inputs, taken as runs captioned by one and the same element,
  // whose caption lists several fields: the k-th input of the run is the k-th
  // field named. Only when the run divides evenly into the list — a partial
  // match would be a guess, and a wrong number written into a tax return is
  // worse than no number at all.
  let i = 0;
  while (i < items.length) {
    const start = items[i];
    if (start.key || start.sig.length < 2 || !start.source) {
      i += 1;
      continue;
    }
    let j = i;
    while (j < items.length && !items[j].key && items[j].source === start.source) j += 1;
    const run = j - i;
    if (run % start.sig.length === 0) {
      for (let k = i; k < j; k += 1) items[k].key = start.sig[(k - i) % start.sig.length];
    }
    i = j;
  }

  return items;
}

/**
 * Group the page's inputs into payer blocks: one block per repeated set of
 * fields, in the order they appear on screen.
 *
 * A form may lay a payer out as a card, a table row, or a flat run of inputs.
 * Rather than guess the container, the inputs are taken in document order and a
 * new block is started whenever a field key repeats — which is exactly where
 * the next payer begins in every one of those layouts.
 */
function detectBlocks(root = document) {
  const blocks = [];
  let current = null;
  for (const { key, input } of scanInputs(root)) {
    if (!key) continue;
    if (!current || current[key]) {
      current = {};
      blocks.push(current);
    }
    current[key] = input;
  }
  // A block with only one field is noise (a search box captioned "เงินได้",
  // say) — a payer needs an identity plus an amount. The real form has no
  // payer-name box at all, so the id alone can stand for the identity.
  const usable = blocks.filter(
    (b) => (b.issuer_name || b.issuer_tax_id) && (b.gross_interest || b.wht_amount),
  );
  for (const b of usable) b.__row = commonAncestor(orderedKeys(b).map((k) => b[k]));
  return expandRows(usable);
}

/** The lowest element that contains every one of `nodes`. */
function commonAncestor(nodes) {
  let node = nodes[0];
  while (node && !nodes.every((n) => node.contains(n))) node = node.parentElement;
  return node;
}

/** A block's fields in the order they appear on the page. */
function orderedKeys(block) {
  return FIELD_KEYS.filter((k) => block[k]).sort((a, b) =>
    block[a].compareDocumentPosition(block[b]) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  );
}

/**
 * Read one detected row as a template for the rest.
 *
 * Detection leans on the captions the form renders, and a row the user has just
 * added by pressing "เพิ่มรายการอื่น" has none yet — no validation has run on
 * it. But it is the same markup as the row beside it, so once ONE row is
 * understood, its siblings of the same shape are filled in the same order.
 */
function expandRows(blocks) {
  if (!blocks.length) return blocks;
  const seq = orderedKeys(blocks[0]);
  const row = commonAncestor(seq.map((k) => blocks[0][k]));
  if (!row?.parentElement || !seq.length) return blocks;

  const peers = [...row.parentElement.children].filter(
    (c) => c.tagName === row.tagName && c.className === row.className,
  );
  if (peers.length <= blocks.length) return blocks;

  const out = [];
  for (const peer of peers) {
    const inputs = [...peer.querySelectorAll("input, textarea")].filter(isFillable);
    if (inputs.length !== seq.length) continue;
    const block = { __row: peer };
    seq.forEach((k, i) => {
      block[k] = inputs[i];
    });
    out.push(block);
  }
  return out.length >= blocks.length ? out : blocks;
}

/** Dropdowns that could hold an income type. Site navigation is not one. */
const TYPE_CONTROL_SELECTOR =
  "ng-select, mat-select, select, [role=combobox], [aria-haspopup=listbox], .ui-dropdown";

/**
 * Every income-type dropdown on the page, in document order.
 *
 * ng-select and friends hide a `role="combobox"` <input> inside the widget for
 * typing into. That input matches the selector but is the wrong handle: an
 * <input> has no textContent, so reading the chosen option back off it always
 * comes up empty and a successful pick reads as a failure. Climb to the widget,
 * which is what actually displays the label, and drop the duplicate.
 */
function allTypeControls() {
  const seen = new Set();
  const out = [];
  for (const raw of document.querySelectorAll(TYPE_CONTROL_SELECTOR)) {
    if (raw.closest("nav, header, .navbar")) continue; // the site's own menus
    const node = raw.closest("ng-select, mat-select, .ui-dropdown") ?? raw;
    if (seen.has(node)) continue;
    seen.add(node);
    out.push(node);
  }
  return out;
}

/**
 * The income-type dropdown belonging to a payer row.
 *
 * Every payer gets its own picker, and it is not inside the row's own box: the
 * "เลือกประเภทของเงินได้" control sits above the line of amount fields it
 * belongs to. So the rule is the one a reader uses — the row is governed by the
 * NEAREST picker above it, never by the first one on the page, which is the
 * previous payer's and is already filled in.
 */
function typeControlFor(scope) {
  const controls = allTypeControls();
  if (scope === document) return controls[0] ?? null;

  const inside = controls.find((c) => scope.contains(c));
  if (inside) return inside;

  let nearest = null;
  for (const c of controls) {
    // `c` comes before the row (or contains it): keep looking for a later one.
    if (c.compareDocumentPosition(scope) & Node.DOCUMENT_POSITION_FOLLOWING) nearest = c;
  }
  return nearest ?? controls[0] ?? null;
}

/**
 * Set the income-type dropdown to the bond-interest option.
 *
 * Native <select> is set directly; ng-select and friends are driven the way a
 * person would — open, read what appeared, click the best match — because a
 * custom dropdown keeps its value in framework state that assigning to the DOM
 * would not reach. Already-correct is success: the picker usually governs the
 * whole card, so filling the second payer must not re-open and re-pick it.
 */
async function chooseIncomeType(scope = document) {
  const control = typeControlFor(scope);
  const step = { step: "type", control: describeNode(control), controls: allTypeControls().length };
  trace(step);
  if (!control) {
    step.result = "no-control";
    return false;
  }
  if (optionScore(tidy(control.textContent)) >= TYPE_MIN_SCORE) {
    step.result = "already-set";
    return true;
  }

  const pick = (nodes, read = (n) => tidy(n.textContent)) => {
    let best = null;
    let bestScore = 0;
    for (const n of nodes) {
      const text = read(n);
      if (!text || text.length > 300) continue;
      const score = optionScore(text);
      if (score > bestScore) {
        bestScore = score;
        best = n;
      }
    }
    return bestScore >= TYPE_MIN_SCORE ? best : null;
  };

  if (control.tagName === "SELECT") {
    const opt = pick(control.options);
    if (!opt) {
      step.result = "no-matching-option";
      return false;
    }
    control.value = opt.value;
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  // ng-select opens on mousedown over its container, not on a plain click.
  const opener = control.querySelector(".ng-select-container, .mat-select-trigger") ?? control;
  for (const type of ["pointerdown", "mousedown", "click"]) {
    opener.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
  }
  await pause(400);

  // The panel is portalled to the end of <body>, so it is looked for across the
  // document rather than inside the control.
  // The site's own account and service menus are ".dropdown-item" too, and are
  // sitting in the DOM the whole time — they are not options here.
  const opts = [...document.querySelectorAll(".ng-option, [role=option], mat-option, .dropdown-item, .ui-dropdown-item")].filter(
    (o) => !o.closest("nav, header, .navbar"),
  );
  step.opened = opts.length;
  step.sample = opts.slice(0, 6).map((o) => tidy(o.textContent).slice(0, 70));
  const opt = pick(opts);
  if (opt) {
    for (const type of ["pointerdown", "mousedown", "click"]) {
      opt.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    }
    await pause(300);
    const ok = optionScore(tidy(control.textContent)) >= TYPE_MIN_SCORE;
    step.result = ok ? "picked" : "clicked-but-label-unchanged";
    step.after = tidy(control.textContent).slice(0, 70);
    return ok;
  }
  step.result = opts.length ? "no-matching-option" : "panel-did-not-open";
  control.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  return false;
}

/** An enabled "add another row" button inside `root`, if there is one. */
function matchAddRow(root) {
  for (const node of root.querySelectorAll("button, a[role=button], [class*=add], [class*=Add]")) {
    if (node.disabled || node.getAttribute("aria-disabled") === "true") continue;
    const text = tidy(node.textContent);
    if (!text || text.length > 30) continue;
    if (ADD_ROW_PATTERNS.some((re) => re.test(text))) return node;
  }
  return null;
}

/**
 * The button that adds another payer row to the card `scope` sits in.
 *
 * The return has several income cards on one page and each carries its own
 * "เพิ่มรายการอื่น", so taking the first one in the document adds a row to
 * whichever card happens to come first — which is why the search starts at the
 * row and widens outwards, and only falls back to the page as a whole.
 */
function findAddRowButton(scope = document) {
  let node = scope === document ? document.body : scope;
  for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
    const hit = matchAddRow(node);
    if (hit) return hit;
  }
  return matchAddRow(document);
}

/** Press something the way a mouse would; Angular ignores some bare clicks. */
function pressLikeAMouse(node) {
  node.scrollIntoView?.({ block: "center", behavior: "instant" });
  for (const type of ["pointerdown", "mousedown", "mouseup", "click"]) {
    node.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
  }
}

/**
 * A compact description of every candidate input on the page, for when
 * detection misses and someone has to look at what the form actually renders.
 * No values are included — only what the page itself displays as captions.
 */
function describeForm() {
  const out = scanInputs().map(({ input, own, block, key, sig }) => {
    const box = input.getBoundingClientRect();
    return {
      tag: input.tagName.toLowerCase(),
      type: input.type || "",
      id: input.id || "",
      name: input.getAttribute("name") || "",
      own: own.slice(0, 160),
      block: block.slice(0, 240),
      sig: sig.join(","),
      guess: key || "",
      at: `${Math.round(box.left)},${Math.round(box.top)} ${Math.round(box.width)}x${Math.round(box.height)}`,
    };
  });
  const dropdowns = [];
  for (const node of document.querySelectorAll(TYPE_CONTROL_SELECTOR)) {
    if (node.closest("nav, header, .navbar")) continue;
    const box = node.getBoundingClientRect();
    dropdowns.push({
      tag: node.tagName.toLowerCase(),
      cls: tidy(typeof node.className === "string" ? node.className : "").slice(0, 80),
      shown: tidy(node.textContent || node.value).slice(0, 120),
      // Custom dropdowns render nothing until opened, so this is usually empty
      // and the live open/click path is the only way to know what is in them.
      options: [...(node.options ?? [])].map((o) => tidy(o.textContent).slice(0, 120)).slice(0, 30),
      at: `${Math.round(box.left)},${Math.round(box.top)} ${Math.round(box.width)}x${Math.round(box.height)}`,
    });
  }
  return JSON.stringify(
    {
      url: location.pathname,
      addRow: tidy(findAddRowButton()?.textContent) || null,
      blocks: detectBlocks().length,
      dropdowns,
      inputs: out,
    },
    null,
    1,
  );
}
