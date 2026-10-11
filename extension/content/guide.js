// The route from e-Filing's front page to the 40(4) income screen, played back
// inside the panel.
//
// The rest of the panel only works once the user is already on that screen,
// which is six clicks deep; on any other page all it can honestly say is that
// it found no fields. This is the missing half. It is a drawing, not a copy:
// efiling.rd.go.th is the Revenue Department's, and every frame carries a label
// saying so, because this renders ON their site where the line matters most.
//
// Menu labels are transcribed from the real flow and are the part most likely
// to drift — check them against the live site when it changes.
//
// Loaded before content/efiling.js, which calls buildGuide().

const GUIDE_STEPS = [
  {
    caption: "เข้าเว็บกรมสรรพากรแล้วเข้าสู่ระบบ",
    url: "efiling.rd.go.th",
    heading: "ยื่นแบบและชำระภาษีออนไลน์",
    items: ["เข้าสู่ระบบ", "สมัครสมาชิก", "ตรวจสอบผลการยื่นแบบ"],
    hit: 0,
    note: "ใช้เลขบัตรประชาชน 13 หลัก",
  },
  {
    caption: "เลือกแบบภาษีเงินได้บุคคลธรรมดา",
    url: "หน้าหลัก",
    heading: "เลือกแบบที่ต้องการยื่น",
    items: ["ภ.ง.ด.90/91 — ภาษีเงินได้บุคคลธรรมดา", "ภ.ง.ด.94 — ครึ่งปี", "ภ.พ.30 — ภาษีมูลค่าเพิ่ม"],
    hit: 0,
    note: "ดอกเบี้ยหุ้นกู้อยู่ใน ภ.ง.ด.90",
  },
  {
    caption: "ผ่านหน้าข้อมูลผู้เสียภาษี ไปขั้นตอนรายได้",
    url: "ภ.ง.ด.90/91 · ขั้นตอนที่ 1",
    heading: "ขั้นตอนการยื่นแบบ",
    items: ["ข้อมูลผู้เสียภาษี", "ระบุเงินได้", "ระบุค่าลดหย่อน", "ตรวจสอบข้อมูล"],
    hit: 1,
  },
  {
    caption: "เลือกหมวดเงินได้จากการลงทุน",
    url: "ระบุเงินได้",
    heading: "เลือกประเภทเงินได้ที่ได้รับ",
    items: [
      "เงินได้จากการจ้างงาน (มาตรา 40(1))",
      "เงินได้จากทรัพย์สิน / การลงทุน (มาตรา 40(4))",
      "เงินได้จากวิชาชีพอิสระ (มาตรา 40(6))",
      "เงินได้จากธุรกิจ (มาตรา 40(8))",
    ],
    hit: 1,
    note: "ต้องติ๊กหมวดนี้ก่อน หัวข้อดอกเบี้ยถึงจะโผล่",
  },
  {
    caption: "เปิดหัวข้อดอกเบี้ยและเงินปันผล",
    url: "เงินได้ 40(4)",
    heading: "เงินได้จากทรัพย์สิน การลงทุน",
    items: [
      "ดอกเบี้ย เงินปันผล เงินเทียบเท่าเงินปันผล (มาตรา 40(4))",
      "ขายอสังหาริมทรัพย์ (มาตรา 40(8))",
      "เงินได้จากการขายหน่วยลงทุน",
    ],
    hit: 0,
  },
  {
    caption: "ถึงหน้ากรอกแล้ว — กด “กรอกเลย” ในการ์ดนี้ได้เลย",
    url: "ดอกเบี้ย 40(4)",
    heading: "ผู้จ่ายเงินได้รายที่ 1",
    items: ["ประเภทธุรกิจ", "จำนวนเงินได้", "ภาษีหัก ณ ที่จ่าย", "เลขประจำตัวผู้เสียภาษีผู้จ่าย"],
    hit: -1,
    note: "ไม่ต้องกรอกทีละช่อง",
  },
];

const GUIDE_DWELL = 3000; // ms per step while playing

let guideTimer = null;

/** Stop the playback timer. Called before every panel re-render. */
function stopGuide() {
  clearTimeout(guideTimer);
  guideTimer = null;
}

/**
 * The guide as a self-contained element: it owns its own step state and timer
 * and never asks the panel to re-render, so playing it cannot disturb a fill in
 * progress or rebuild the payer list underneath it.
 */
function buildGuide() {
  let i = 0;
  let playing = true;

  const wrap = document.createElement("div");
  wrap.className = "beond-guide";

  const frame = document.createElement("div");
  frame.className = "beond-guide-frame";
  const bar = document.createElement("div");
  bar.className = "beond-guide-bar";
  const url = document.createElement("span");
  url.className = "beond-guide-url";
  const fake = document.createElement("span");
  fake.className = "beond-guide-fake";
  fake.textContent = "ภาพจำลอง";
  bar.append(url, fake);
  const screen = document.createElement("div");
  screen.className = "beond-guide-screen";
  frame.append(bar, screen);

  const caption = document.createElement("p");
  caption.className = "beond-guide-caption";
  const note = document.createElement("p");
  note.className = "beond-guide-note";

  const controls = document.createElement("div");
  controls.className = "beond-guide-controls";
  const prev = button("‹", "ขั้นก่อนหน้า");
  const play = button("‖", "หยุด");
  play.classList.add("beond-guide-play");
  const next = button("›", "ขั้นถัดไป");
  const dots = document.createElement("div");
  dots.className = "beond-guide-dots";
  controls.append(prev, play, next, dots);

  wrap.append(frame, caption, note, controls);

  function button(label, title) {
    const b = document.createElement("button");
    b.className = "beond-guide-btn";
    b.textContent = label;
    b.title = title;
    b.type = "button";
    return b;
  }

  function schedule() {
    stopGuide();
    // Stop at the end rather than looping: the last screen is the destination,
    // and snapping back to step one reads as a failure.
    if (!playing || i === GUIDE_STEPS.length - 1) return;
    guideTimer = setTimeout(() => {
      i += 1;
      draw();
    }, GUIDE_DWELL);
  }

  function go(n) {
    i = Math.min(Math.max(n, 0), GUIDE_STEPS.length - 1);
    draw();
  }

  function draw() {
    const step = GUIDE_STEPS[i];
    const last = i === GUIDE_STEPS.length - 1;
    if (last) playing = false;

    url.textContent = step.url;
    caption.textContent = `${i + 1}. ${step.caption}`;
    note.textContent = step.note ?? "";
    note.style.display = step.note ? "" : "none";

    screen.innerHTML = "";
    screen.classList.remove("beond-guide-in");
    // Restart the entry transition: reading offsetWidth forces the removal to
    // land before the class goes back on, which is what makes it replay.
    void screen.offsetWidth;
    screen.classList.add("beond-guide-in");

    const h = document.createElement("p");
    h.className = "beond-guide-heading";
    h.textContent = step.heading;
    screen.append(h);

    step.items.forEach((label, n) => {
      const row = document.createElement("div");
      row.className = `beond-guide-row${n === step.hit ? " beond-guide-hit" : ""}`;
      const text = document.createElement("span");
      text.textContent = label;
      row.append(text);
      if (n === step.hit) {
        const cursor = document.createElement("span");
        cursor.className = "beond-guide-cursor";
        row.append(cursor);
      }
      screen.append(row);
    });

    prev.disabled = i === 0;
    next.disabled = last;
    play.textContent = last ? "↻" : playing ? "‖" : "▶";
    play.title = last ? "เล่นใหม่" : playing ? "หยุด" : "เล่น";

    dots.innerHTML = "";
    GUIDE_STEPS.forEach((_, n) => {
      const d = document.createElement("button");
      d.type = "button";
      d.className = `beond-guide-dot${n === i ? " beond-guide-dot-on" : ""}`;
      d.title = `ขั้นที่ ${n + 1}`;
      d.onclick = () => {
        playing = false;
        go(n);
      };
      dots.append(d);
    });

    schedule();
  }

  prev.onclick = () => {
    playing = false;
    go(i - 1);
  };
  next.onclick = () => {
    playing = false;
    go(i + 1);
  };
  play.onclick = () => {
    if (i === GUIDE_STEPS.length - 1) {
      playing = true;
      go(0);
      return;
    }
    playing = !playing;
    draw();
  };

  draw();
  return wrap;
}
