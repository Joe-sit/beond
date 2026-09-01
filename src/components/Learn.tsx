/**
 * Public tax guides, served at `/learn` and `/learn/<slug>`.
 *
 * Two jobs, one page. beond's product is behind a LINE login, so a search
 * engine — and an AdSense reviewer — sees almost nothing of it; and the
 * questions these answer are exactly the ones a bond investor asks before they
 * would ever think to look for an app. So the guides are written to stand on
 * their own, and the app is mentioned only where it is genuinely the shortcut.
 *
 * Thai only, deliberately: the reader is filing a Thai return, and a half-
 * translated tax explanation is worse than none.
 *
 * Figures here are the ones in force for tax year 2568 (2025). When the
 * brackets or the allowance change, change them in RATE_TABLE and in the
 * worked examples together — they are checked against each other by eye, not
 * by code.
 */
import { useEffect } from "react";
import wordmark from "../assets/landing-logo.svg?raw";

const SITE = "https://beond-dashboard.vercel.app";
const UPDATED = "1 กันยายน 2569";

/** Personal income tax brackets, tax year 2568. */
const RATE_TABLE = {
  head: ["เงินได้สุทธิ (บาท)", "อัตราภาษี"],
  rows: [
    ["0 – 150,000", "ยกเว้น"],
    ["150,001 – 300,000", "5%"],
    ["300,001 – 500,000", "10%"],
    ["500,001 – 750,000", "15%"],
    ["750,001 – 1,000,000", "20%"],
    ["1,000,001 – 2,000,000", "25%"],
    ["2,000,001 – 5,000,000", "30%"],
    ["5,000,001 ขึ้นไป", "35%"],
  ],
};

type Block =
  | { h: string }
  | { p: string }
  | { list: string[] }
  | { steps: string[] }
  | { table: { head: string[]; rows: string[][] } }
  | { note: string };

type Article = {
  slug: string;
  title: string;
  /** Meta description and the summary on the index. One sentence. */
  description: string;
  minutes: number;
  blocks: Block[];
};

const ARTICLES: Article[] = [
  {
    slug: "wht-15",
    title: "ภาษีหัก ณ ที่จ่าย 15% จากดอกเบี้ยหุ้นกู้ คืออะไร และใครขอคืนได้",
    description:
      "ดอกเบี้ยหุ้นกู้ถูกหักภาษี ณ ที่จ่าย 15% เท่ากันทุกคน ไม่ว่าจะมีรายได้เท่าไร คนที่ฐานภาษีจริงต่ำกว่า 15% จึงจ่ายเกิน และขอคืนส่วนต่างได้",
    minutes: 5,
    blocks: [
      {
        p: "ทุกครั้งที่หุ้นกู้จ่ายดอกเบี้ย ผู้ออกหุ้นกู้จะหักภาษี ณ ที่จ่ายไว้ 15% ของดอกเบี้ยก้อนนั้นแล้วนำส่งกรมสรรพากรแทนคุณ เงินที่เข้าบัญชีจึงเป็นยอดหลังหักภาษีแล้ว และคุณจะได้เอกสารหนึ่งใบต่อหนึ่งงวด เรียกว่า “หนังสือรับรองการหักภาษี ณ ที่จ่าย” หรือที่ทุกคนเรียกกันว่า ใบ 50 ทวิ",
      },
      { h: "15% ไม่ใช่ภาษีที่คุณต้องจ่ายจริง" },
      {
        p: "อัตรา 15% นี้เป็นอัตราคงที่ ไม่ได้ดูว่าคุณมีรายได้ทั้งปีเท่าไร นักลงทุนที่มีเงินได้สุทธิ 200,000 บาท กับคนที่มี 3,000,000 บาท ถูกหักเท่ากันหมด แต่ภาษีเงินได้บุคคลธรรมดาของไทยคิดแบบขั้นบันได คนสองคนนี้จึงมีภาระภาษีจริงไม่เท่ากันเลย",
      },
      { table: RATE_TABLE },
      {
        p: "ถ้าเงินได้สุทธิของคุณอยู่ในขั้น 0%, 5% หรือ 10% แปลว่าภาษีที่ถูกหักไป 15% นั้น “มากกว่า” ที่ควรจ่าย ส่วนต่างนั้นขอคืนได้ ในทางกลับกัน ถ้าฐานภาษีของคุณสูงกว่า 15% การปล่อยให้ถูกหัก 15% แล้วจบไปเลยจะคุ้มกว่า",
      },
      { h: "ใครควรขอคืน" },
      {
        list: [
          "ผู้เกษียณที่ไม่มีเงินเดือนแล้ว รายได้หลักคือดอกเบี้ยและเงินปันผล",
          "นักลงทุนที่เงินได้สุทธิทั้งปีไม่ถึง 500,000 บาท (ขั้นสูงสุดที่ยังต่ำกว่า 15%)",
          "คนที่เพิ่งเริ่มทำงาน หรือทำงานไม่เต็มปี",
          "ผู้ที่มีค่าลดหย่อนมาก จนเงินได้สุทธิลดลงมาต่ำกว่าที่คิด",
        ],
      },
      {
        note: "เงินได้สุทธิ คือ รายได้ทั้งปี ลบค่าใช้จ่าย ลบค่าลดหย่อนแล้ว ไม่ใช่เงินเดือนคูณสิบสอง คนจำนวนมากประเมินฐานภาษีตัวเองสูงเกินจริง เพราะดูจากรายได้ก่อนหักลดหย่อน",
      },
      { h: "ขอคืนได้เท่าไร" },
      {
        p: "สมมติปีนี้คุณได้ดอกเบี้ยหุ้นกู้รวม 66,000 บาท ถูกหักภาษีไว้ 9,900 บาท และเงินได้สุทธิของคุณอยู่ในขั้น 5% ภาษีที่ควรจ่ายจากดอกเบี้ยก้อนนี้คือราว 3,300 บาท ส่วนต่างประมาณ 6,600 บาท คือเงินที่ขอคืนได้ — เป็นเงินของคุณที่ค้างอยู่กับกรมสรรพากรเฉย ๆ ถ้าไม่ยื่นก็ไม่ได้คืน",
      },
      {
        p: "ตัวเลขจริงขึ้นกับรายได้อื่นและค่าลดหย่อนของคุณด้วย เพราะดอกเบี้ยจะถูกนำไปรวมกับรายได้ทางอื่นก่อนแล้วจึงคำนวณตามขั้นบันได อ่านต่อได้ที่ เลือก Final Tax หรือนำมารวมคำนวณ",
      },
      { h: "ต้องเก็บอะไรไว้บ้าง" },
      {
        p: "ใบ 50 ทวิ ทุกใบของปีนั้น หนึ่งงวดดอกเบี้ยคือหนึ่งใบ ถ้าถือหุ้นกู้ 5 ตัว จ่ายดอกเบี้ยปีละ 2 ครั้ง ก็คือ 10 ใบต่อปี ในใบจะมีสิ่งที่ต้องกรอกลงแบบ ภ.ง.ด.90 ครบ คือ ชื่อผู้จ่าย เลขประจำตัวผู้เสียภาษี 13 หลักของผู้จ่าย จำนวนเงินได้ และภาษีที่ถูกหักไว้",
      },
      {
        note: "บทความนี้เป็นความรู้ทั่วไป ไม่ใช่คำแนะนำทางภาษีเฉพาะราย กรณีที่ซับซ้อนควรปรึกษาผู้ทำบัญชีหรือสรรพากรพื้นที่",
      },
    ],
  },
  {
    slug: "final-tax-or-file",
    title: "เลือก Final Tax หรือนำดอกเบี้ยมารวมคำนวณ แบบไหนคุ้มกว่า",
    description:
      "ดอกเบี้ยหุ้นกู้เลือกได้สองทาง จบที่หัก 15% ไปเลย หรือนำมารวมคำนวณแล้วใช้ภาษีที่ถูกหักเป็นเครดิต วิธีดูว่าทางไหนคุ้มกว่าสำหรับคุณ",
    minutes: 6,
    blocks: [
      {
        p: "กฎหมายให้สิทธิผู้มีเงินได้เลือกเองว่าจะจัดการดอกเบี้ยที่ถูกหักภาษีไว้แล้วอย่างไร สองทางเลือกนี้ให้ผลต่างกันเป็นเงินจริง และเลือกใหม่ได้ทุกปี",
      },
      { h: "ทางเลือกที่ 1 — ปล่อยให้เป็น Final Tax" },
      {
        p: "ไม่ต้องนำดอกเบี้ยไปกรอกในแบบแสดงรายการเลย ถือว่าภาษี 15% ที่ถูกหักไว้เป็นภาระภาษีสุดท้ายของเงินก้อนนั้นแล้ว ง่ายที่สุด ไม่ต้องเก็บใบ 50 ทวิ ไม่ต้องกรอกอะไรเพิ่ม",
      },
      { h: "ทางเลือกที่ 2 — นำมารวมคำนวณ" },
      {
        p: "นำดอกเบี้ยไปรวมกับรายได้อื่นในแบบ ภ.ง.ด.90 คำนวณภาษีตามขั้นบันไดตามปกติ แล้วนำภาษี 15% ที่ถูกหักไว้แล้วมาเป็นเครดิตหักออกจากภาษีที่ต้องจ่าย ถ้าเครดิตมากกว่าภาษีที่ต้องจ่าย ส่วนเกินคือเงินคืน",
      },
      { h: "เส้นแบ่งอยู่ที่ 15%" },
      {
        p: "หลักง่าย ๆ คือเทียบอัตราภาษีขั้นสูงสุดของคุณกับ 15% ถ้าเงินได้สุทธิของคุณอยู่ในขั้นที่ต่ำกว่า 15% การนำมารวมคำนวณจะได้เงินคืน ถ้าอยู่ในขั้นที่สูงกว่า 15% การนำมารวมจะทำให้ต้องจ่ายเพิ่ม ปล่อยเป็น Final Tax คุ้มกว่า",
      },
      { table: RATE_TABLE },
      {
        list: [
          "เงินได้สุทธิไม่เกิน 500,000 บาท — ขั้นสูงสุดคือ 10% ต่ำกว่า 15% นำมารวมคำนวณแล้วได้คืน",
          "เงินได้สุทธิ 500,001 – 750,000 บาท — ขั้นสูงสุดคือ 15% พอดี ผลลัพธ์ใกล้เคียงศูนย์ ต้องลองคำนวณจริง",
          "เงินได้สุทธิเกิน 750,000 บาท — ขั้นสูงสุด 20% ขึ้นไป นำมารวมแล้วจ่ายเพิ่ม ปล่อยเป็น Final Tax",
        ],
      },
      { h: "ข้อควรระวัง: เลือกแล้วต้องเอามาทั้งหมด" },
      {
        p: "ถ้าตัดสินใจนำดอกเบี้ยมารวมคำนวณ ต้องนำดอกเบี้ยในประเภทเดียวกันมารวม “ทั้งหมด” จะเลือกเอามาเฉพาะใบที่ได้เปรียบไม่ได้ ดังนั้นก่อนตัดสินใจ ควรรวมยอดดอกเบี้ยและภาษีที่ถูกหักของทั้งปีให้ครบก่อน แล้วค่อยคำนวณเทียบ",
      },
      { h: "วิธีเช็กแบบไม่ต้องคำนวณเอง" },
      {
        p: "สิ่งที่ต้องรู้มีแค่สองอย่าง คือรายได้รวมทั้งปีก่อนรวมดอกเบี้ย และยอดดอกเบี้ยหุ้นกู้ทั้งปี จากนั้นคำนวณเงินได้สุทธิแล้วเทียบกับตารางข้างบน ถ้าไม่อยากคำนวณเอง หน้า “ฐานภาษี” ในแอป beond ทำให้ดู โดยกรอกรายได้ช่องเดียวแล้วเห็นทันทีว่าปีนี้ควรขอคืนหรือปล่อยเป็น Final Tax และได้คืนประมาณเท่าไร",
      },
      {
        note: "บทความนี้เป็นความรู้ทั่วไป ไม่ใช่คำแนะนำทางภาษีเฉพาะราย กรณีที่ซับซ้อนควรปรึกษาผู้ทำบัญชีหรือสรรพากรพื้นที่",
      },
    ],
  },
  {
    slug: "file-pnd90",
    title: "วิธียื่น ภ.ง.ด.90 สำหรับดอกเบี้ยหุ้นกู้ ทีละขั้น",
    description:
      "ขั้นตอนยื่นภาษีออนไลน์เพื่อขอคืนภาษีหัก ณ ที่จ่ายจากดอกเบี้ยหุ้นกู้ ตั้งแต่รวบรวมใบ 50 ทวิ จนถึงกรอกเงินได้มาตรา 40(4)",
    minutes: 7,
    blocks: [
      {
        p: "ดอกเบี้ยหุ้นกู้เป็นเงินได้ตามมาตรา 40(4)(ก) ผู้ที่มีเงินได้ประเภทนี้และต้องการนำมารวมคำนวณ ต้องยื่นด้วยแบบ ภ.ง.ด.90 ไม่ใช่ ภ.ง.ด.91 (ซึ่งใช้เฉพาะผู้มีเงินเดือนอย่างเดียว) ยื่นออนไลน์ได้ที่เว็บของกรมสรรพากร",
      },
      { h: "เตรียมก่อนเริ่ม" },
      {
        list: [
          "ใบ 50 ทวิ ของดอกเบี้ยหุ้นกู้ทุกงวดในปีภาษีนั้น",
          "เอกสารรายได้อื่น เช่น หนังสือรับรองเงินเดือน (50 ทวิ ของนายจ้าง)",
          "เอกสารค่าลดหย่อน เช่น เบี้ยประกัน กองทุน ดอกเบี้ยบ้าน",
          "เลขบัญชีพร้อมเพย์ที่ผูกกับเลขบัตรประชาชน สำหรับรับเงินคืน",
        ],
      },
      { h: "ขั้นตอน" },
      {
        steps: [
          "เข้า efiling.rd.go.th แล้วเข้าสู่ระบบ หากยังไม่เคยใช้ ให้สมัครสมาชิกด้วยเลขบัตรประชาชนก่อน",
          "เลือกยื่นแบบ ภ.ง.ด.90 ของปีภาษีที่ต้องการ",
          "กรอกข้อมูลผู้มีเงินได้และสถานะครอบครัว",
          "ในหน้าเงินได้ เลือกหัวข้อเงินได้จากดอกเบี้ย มาตรา 40(4)",
          "เลือกประเภทเป็น “ดอกเบี้ย (เฉพาะที่ไม่เลือกเสียภาษีในอัตราร้อยละ 15.0)” ซึ่งคือการเลือกนำมารวมคำนวณ",
          "กรอกทีละผู้จ่าย: เงินได้ทั้งหมด ภาษีหัก ณ ที่จ่าย และเลขประจำตัวผู้เสียภาษี 13 หลักของผู้จ่าย ตามที่ระบุในใบ 50 ทวิ แต่ละใบ",
          "ถ้ามีผู้จ่ายหลายราย กดปุ่มเพิ่มรายการแล้วกรอกต่อจนครบทุกใบ",
          "กรอกรายได้อื่นและค่าลดหย่อนให้ครบ",
          "ตรวจสรุปยอด ระบบจะแสดงว่าต้องชำระเพิ่มหรือได้คืนเท่าไร",
          "ยืนยันการยื่น และเลือกรับเงินคืนผ่านพร้อมเพย์",
        ],
      },
      { h: "จุดที่คนกรอกผิดบ่อย" },
      {
        list: [
          "กรอกยอดดอกเบี้ยที่ได้รับจริง (หลังหักภาษี) แทนที่จะเป็นเงินได้ก่อนหักตามใบ 50 ทวิ",
          "ใส่เลขผู้เสียภาษีของนายหน้าหรือธนาคารตัวแทน แทนที่จะเป็นของผู้ออกหุ้นกู้ตามที่ระบุในใบ",
          "กรอกไม่ครบทุกใบ ทั้งที่เลือกนำมารวมคำนวณแล้วต้องนำมาทั้งหมด",
          "เลือกประเภทเงินได้ผิดหัวข้อ ทำให้ระบบไม่คิดเครดิตภาษีให้",
        ],
      },
      { h: "กำหนดเวลา" },
      {
        p: "ยื่นได้ตั้งแต่ต้นปีถัดจากปีภาษี โดยการยื่นแบบกระดาษหมดเขตสิ้นเดือนมีนาคม ส่วนการยื่นออนไลน์มักได้ขยายเวลาถึงราวต้นเดือนเมษายน ควรตรวจกำหนดวันที่แน่นอนของแต่ละปีจากประกาศกรมสรรพากร เงินคืนมักเข้าพร้อมเพย์ภายในไม่กี่สัปดาห์หลังผ่านการตรวจ",
      },
      { h: "ถ้าใบ 50 ทวิ เยอะจนกรอกไม่ไหว" },
      {
        p: "นักลงทุนที่ถือหุ้นกู้หลายตัวจะมีใบ 50 ทวิ สิบกว่าใบต่อปี และแต่ละใบต้องกรอกสี่ช่อง นี่คือจุดที่ beond ถูกสร้างขึ้นมาช่วย โดยอ่านตัวเลขจากภาพใบ 50 ทวิ เก็บรวมไว้ทั้งปี แล้วส่งเข้าแบบฟอร์มของกรมสรรพากรให้ในคลิกเดียวผ่านส่วนขยายเบราว์เซอร์ ตัวเลขที่กรอกยังเป็นตัวเลขที่คุณยืนยันเองทุกใบ",
      },
      {
        note: "บทความนี้เป็นความรู้ทั่วไป ไม่ใช่คำแนะนำทางภาษีเฉพาะราย กรณีที่ซับซ้อนควรปรึกษาผู้ทำบัญชีหรือสรรพากรพื้นที่",
      },
    ],
  },
];

/** Title, description, canonical and structured data for the page being read. */
function useDocumentHead(title: string, description: string, path: string, article?: Article) {
  useEffect(() => {
    const previous = document.title;
    document.title = title;

    const meta = (selector: string, create: () => HTMLElement) => {
      let el = document.head.querySelector<HTMLElement>(selector);
      if (!el) {
        el = create();
        document.head.appendChild(el);
      }
      return el;
    };

    const desc = meta('meta[name="description"]', () => {
      const m = document.createElement("meta");
      m.setAttribute("name", "description");
      return m;
    });
    const previousDesc = desc.getAttribute("content");
    desc.setAttribute("content", description);

    const canonical = meta('link[rel="canonical"]', () => {
      const l = document.createElement("link");
      l.setAttribute("rel", "canonical");
      return l;
    });
    const previousCanonical = canonical.getAttribute("href");
    canonical.setAttribute("href", SITE + path);

    // Structured data, so the guide can be understood as an article rather than
    // as an app screen that happens to have words on it.
    let ld: HTMLScriptElement | null = null;
    if (article) {
      ld = document.createElement("script");
      ld.type = "application/ld+json";
      ld.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: article.title,
        description: article.description,
        inLanguage: "th-TH",
        mainEntityOfPage: SITE + path,
        publisher: { "@type": "Organization", name: "beond" },
      });
      document.head.appendChild(ld);
    }

    return () => {
      document.title = previous;
      if (previousDesc) desc.setAttribute("content", previousDesc);
      if (previousCanonical) canonical.setAttribute("href", previousCanonical);
      ld?.remove();
    };
  }, [title, description, path, article]);
}

function Header() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <a href="/" className="flex items-center gap-3" aria-label="beond">
        <span
          className="block h-7 w-auto [&_svg]:h-full [&_svg]:w-auto"
          style={{ ["--fill-0" as string]: "#2968A5" }}
          dangerouslySetInnerHTML={{ __html: wordmark }}
        />
      </a>
      <a
        href="/learn"
        className="rounded-full bg-white px-4 py-1.5 text-sm text-[#43507F] shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition hover:bg-black/5"
      >
        ความรู้ภาษีหุ้นกู้
      </a>
    </header>
  );
}

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        if ("h" in b)
          return (
            <h2 key={i} className="mt-9 text-xl text-[#1B1C1D]">
              {b.h}
            </h2>
          );
        if ("p" in b)
          return (
            <p key={i} className="mt-4 text-[15px] leading-8 text-black/70">
              {b.p}
            </p>
          );
        if ("list" in b)
          return (
            <ul key={i} className="mt-4 space-y-2">
              {b.list.map((item) => (
                <li key={item} className="flex gap-3 text-[15px] leading-7 text-black/70">
                  <span className="mt-3 size-1.5 shrink-0 rounded-full bg-[#43507F]/40" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        if ("steps" in b)
          return (
            <ol key={i} className="mt-4 space-y-3">
              {b.steps.map((item, n) => (
                <li key={item} className="flex gap-3 text-[15px] leading-7 text-black/70">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#43507F]/10 text-xs font-medium text-[#43507F]">
                    {n + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          );
        if ("note" in b)
          return (
            <p key={i} className="mt-5 rounded-2xl bg-[#F0F2F5] p-4 text-sm leading-7 text-black/60">
              {b.note}
            </p>
          );
        return (
          <div key={i} className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[22rem] border-collapse text-[15px]">
              <thead>
                <tr>
                  {b.table.head.map((h) => (
                    <th
                      key={h}
                      className="border-b border-black/10 px-3 py-2 text-left font-medium text-[#1B1C1D] first:pl-0"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.table.rows.map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell) => (
                      <td key={cell} className="border-b border-black/5 px-3 py-2 text-black/70 first:pl-0">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}

function Index() {
  useDocumentHead(
    "ความรู้ภาษีหุ้นกู้ — ขอคืนภาษีหัก ณ ที่จ่าย 15% | beond",
    "คู่มือภาษีสำหรับนักลงทุนหุ้นกู้: ภาษีหัก ณ ที่จ่าย 15% คืออะไร ขอคืนได้เมื่อไร และวิธียื่น ภ.ง.ด.90 ทีละขั้น",
    "/learn",
  );

  return (
    <main className="min-h-svh bg-[#F0F2F5] px-5 py-12 lg:px-12">
      <div className="mx-auto w-full max-w-[46rem]">
        <Header />

        <h1 className="mt-10 text-3xl leading-snug text-[#1B1C1D]">ความรู้ภาษีสำหรับนักลงทุนหุ้นกู้</h1>
        <p className="mt-3 text-[15px] leading-8 text-black/60">
          ดอกเบี้ยหุ้นกู้ถูกหักภาษี ณ ที่จ่าย 15% เท่ากันทุกคน ทั้งที่ภาษีจริงคิดแบบขั้นบันได
          คนที่ฐานภาษีต่ำกว่านั้นจึงจ่ายเกินทุกงวดโดยไม่รู้ตัว หน้านี้รวมสิ่งที่ต้องรู้เพื่อขอคืน
        </p>

        <ul className="mt-8 space-y-4">
          {ARTICLES.map((a) => (
            <li key={a.slug}>
              <a
                href={`/learn/${a.slug}`}
                className="block rounded-3xl bg-white p-6 transition hover:bg-black/[0.02] lg:p-7"
              >
                <h2 className="text-lg leading-snug text-[#1B1C1D]">{a.title}</h2>
                <p className="mt-2 text-[15px] leading-7 text-black/60">{a.description}</p>
                <p className="mt-3 text-sm text-[#2968A5]">อ่าน {a.minutes} นาที →</p>
              </a>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-center text-sm text-black/45">
          อัปเดตล่าสุด {UPDATED} ·{" "}
          <a href="/privacy" className="text-[#2968A5] hover:underline">
            นโยบายความเป็นส่วนตัว
          </a>
        </p>
      </div>
    </main>
  );
}

function ArticlePage({ article }: { article: Article }) {
  useDocumentHead(`${article.title} | beond`, article.description, `/learn/${article.slug}`, article);
  const others = ARTICLES.filter((a) => a.slug !== article.slug);

  return (
    <main className="min-h-svh bg-[#F0F2F5] px-5 py-12 lg:px-12">
      <div className="mx-auto w-full max-w-[46rem]">
        <Header />

        <article className="mt-10 rounded-3xl bg-white p-7 lg:p-10">
          <a href="/learn" className="text-sm text-[#2968A5] hover:underline">
            ← ความรู้ภาษีหุ้นกู้
          </a>
          <h1 className="mt-4 text-3xl leading-snug text-[#1B1C1D]">{article.title}</h1>
          <p className="mt-2 text-sm text-black/45">
            อัปเดต {UPDATED} · อ่าน {article.minutes} นาที
          </p>
          <p className="mt-6 text-[15px] leading-8 text-black/70">{article.description}</p>
          <Blocks blocks={article.blocks} />
        </article>

        <section className="mt-8 rounded-3xl bg-white p-7 lg:p-10">
          <h2 className="text-lg text-[#1B1C1D]">อ่านต่อ</h2>
          <ul className="mt-4 space-y-3">
            {others.map((a) => (
              <li key={a.slug}>
                <a href={`/learn/${a.slug}`} className="text-[15px] leading-7 text-[#2968A5] hover:underline">
                  {a.title}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-10 text-center text-sm text-black/45">
          <a href="/" className="text-[#2968A5] hover:underline">
            รู้จัก beond
          </a>{" "}
          ·{" "}
          <a href="/privacy" className="text-[#2968A5] hover:underline">
            นโยบายความเป็นส่วนตัว
          </a>
        </p>
      </div>
    </main>
  );
}

export default function Learn() {
  const slug = window.location.pathname.replace(/^\/learn\/?/, "").replace(/\/$/, "");
  const article = ARTICLES.find((a) => a.slug === slug);
  return article ? <ArticlePage article={article} /> : <Index />;
}
