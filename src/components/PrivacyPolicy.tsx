/**
 * Public privacy policy, served at `/privacy`.
 *
 * It is not decoration: the Chrome Web Store listing for the e-Filing
 * extension needs a reachable policy URL, and PDPA needs one before the app
 * can be charged for. So it is a public route — no session, no LIFF — and it
 * states what is actually collected and which processors actually see it. If a
 * processor changes (OCR provider, host, analytics), change this page in the
 * same commit.
 *
 * Bilingual because the store reviewer reads English and the user reads Thai.
 */
import { useState } from "react";
import wordmark from "../assets/landing-logo.svg?raw";

const SUPPORT_EMAIL = "beond.support@gmail.com";
const LINE_OA = "@beond";
/** Last substantive change. Shown to the reader and used for consent records. */
const EFFECTIVE = { th: "28 สิงหาคม 2569", en: "28 August 2026" };
const VERSION = "1.0";

type Lang = "th" | "en";

/**
 * Who else touches your data. Overseas vendors are listed by category rather
 * than by brand — PDPA s.23(5) requires the *types* of recipient, and
 * publishing the stack helps nobody decide anything — while Thai agencies are
 * named, because a reader can check those themselves and their involvement is
 * the reassuring part. The current vendor list is given on request.
 */
type Processor = { name: Record<Lang, string>; role: Record<Lang, string>; where: Record<Lang, string> };

const PROCESSORS: Processor[] = [
  {
    name: { th: "ผู้ให้บริการคลาวด์ (ฐานข้อมูลและที่เก็บไฟล์)", en: "Cloud provider (database and file storage)" },
    role: {
      th: "เก็บบัญชี พอร์ต และภาพสลิปของคุณ พร้อมระบบยืนยันตัวตน",
      en: "Holds your account, portfolio and slip images, and runs authentication",
    },
    where: { th: "สิงคโปร์", en: "Singapore" },
  },
  {
    name: { th: "ผู้ให้บริการโฮสต์เว็บและสถิติการเข้าชม", en: "Web hosting and traffic-metrics provider" },
    role: {
      th: "ให้บริการหน้าเว็บ และเก็บสถิติการเข้าชมแบบไม่ระบุตัวตน",
      en: "Serves the web app and records anonymous traffic metrics",
    },
    where: { th: "สหรัฐอเมริกา", en: "United States" },
  },
  {
    name: { th: "แพลตฟอร์มแชท (LINE)", en: "Chat platform (LINE)" },
    role: {
      th: "เข้าสู่ระบบด้วย LINE และการรับส่งข้อความกับบัญชีทางการ beond",
      en: "LINE Login and messaging with the beond official account",
    },
    where: { th: "ญี่ปุ่น / ไทย", en: "Japan / Thailand" },
  },
  {
    name: { th: "ผู้ให้บริการ AI อ่านเอกสาร", en: "AI document-reading provider" },
    role: {
      th: "อ่านตัวเลขและชื่อจากภาพหนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ) ที่คุณส่งเข้ามา",
      en: "Reads the figures and names off the withholding-tax certificates (50 ทวิ) you send",
    },
    where: { th: "สหรัฐอเมริกา", en: "United States" },
  },
  {
    name: { th: "กรมพัฒนาธุรกิจการค้า (DBD)", en: "Department of Business Development (DBD)" },
    role: {
      th: "ตรวจเลขประจำตัวผู้เสียภาษี 13 หลักของผู้จ่ายเงินได้กับทะเบียนนิติบุคคล — ส่งเฉพาะเลขนิติบุคคลของบริษัท ไม่ส่งข้อมูลของคุณ",
      en: "Checks the payer's 13-digit tax id against the juristic-person registry — only the company's id is sent, never yours",
    },
    where: { th: "ไทย", en: "Thailand" },
  },
  {
    name: { th: "ก.ล.ต. และ ThaiBMA", en: "SEC Thailand and ThaiBMA" },
    role: {
      th: "ข้อมูลหุ้นกู้สาธารณะสำหรับแคตตาล็อกในแอป — ไม่มีข้อมูลส่วนบุคคลของคุณ",
      en: "Public bond reference data for the in-app catalogue — none of your personal data",
    },
    where: { th: "ไทย", en: "Thailand" },
  },
  {
    name: { th: "ผู้ให้บริการโลโก้บริษัท", en: "Company-logo provider" },
    role: {
      th: "แสดงโลโก้ของบริษัทผู้ออกหุ้นกู้ — ส่งเฉพาะชื่อโดเมนของบริษัท",
      en: "Shows issuer logos — only the company's domain name is sent",
    },
    where: { th: "สหรัฐอเมริกา", en: "United States" },
  },
];

/** What the app holds about you, grouped the way a reader thinks about it. */
const COLLECTED: { title: Record<Lang, string>; items: Record<Lang, string[]> }[] = [
  {
    title: { th: "บัญชีและการเข้าสู่ระบบ", en: "Account and sign-in" },
    items: {
      th: [
        "LINE user ID, ชื่อที่แสดง และรูปโปรไฟล์ ที่ได้จากการเข้าสู่ระบบด้วย LINE",
        "ภาษาที่เลือก และการตั้งค่าในแอป",
      ],
      en: [
        "LINE user ID, display name and profile picture from LINE Login",
        "Language choice and in-app settings",
      ],
    },
  },
  {
    title: { th: "พอร์ตหุ้นกู้", en: "Bond portfolio" },
    items: {
      th: [
        "หุ้นกู้ที่คุณถือ มูลค่าที่ตราไว้ อัตราดอกเบี้ย งวดจ่าย และวันครบกำหนด",
        "ฐานภาษีเงินได้ที่คุณระบุเอง ใช้คำนวณเงินคืนโดยประมาณ",
      ],
      en: [
        "Bonds you hold, face value, coupon, payment schedule and maturity",
        "The marginal tax rate you enter yourself, used to estimate your refund",
      ],
    },
  },
  {
    title: { th: "หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ)", en: "Withholding-tax certificates (50 ทวิ)" },
    items: {
      th: [
        "ภาพสลิปที่คุณถ่ายหรือส่งเข้ามา",
        "ข้อมูลที่อ่านได้จากสลิป — ชื่อผู้จ่ายเงินได้, เลขประจำตัวผู้เสียภาษี 13 หลักของผู้จ่าย, ดอกเบี้ย, ภาษีหัก ณ ที่จ่าย, ยอดคงเหลือ, วันที่จ่าย และปีภาษี",
        "beond ไม่เก็บเลขประจำตัวประชาชนของคุณ ระบบไม่มีช่องสำหรับเก็บและไม่ได้อ่านค่านั้นจากสลิป",
      ],
      en: [
        "The slip image you photograph or send in",
        "The values read off it — payer name, the payer's 13-digit tax id, interest, tax withheld, net paid, payment date and tax year",
        "beond does not store your own national ID number: there is no column for it and it is not extracted from the slip",
      ],
    },
  },
  {
    title: { th: "บันทึกการใช้งาน", en: "Usage records" },
    items: {
      th: [
        "จำนวนครั้งที่สแกนสลิป เพื่อจำกัดโควตาและตรวจการใช้งานผิดปกติ",
        "บันทึกข้อผิดพลาดฝั่งเซิร์ฟเวอร์ และสถิติการเข้าชมแบบไม่ระบุตัวตน",
      ],
      en: [
        "Slip-scan counts, for quota limits and abuse detection",
        "Server-side error logs and anonymous traffic metrics",
      ],
    },
  },
];

const T = {
  title: { th: "นโยบายความเป็นส่วนตัว", en: "Privacy Policy" },
  effective: { th: "มีผลตั้งแต่", en: "Effective" },
  version: { th: "ฉบับที่", en: "Version" },
  back: { th: "กลับหน้าแรก", en: "Back to home" },
  intro: {
    th: "beond (“เรา”) เป็นแอปสำหรับนักลงทุนหุ้นกู้ ที่ช่วยรวบรวมหนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ) และเตรียมตัวเลขเงินได้มาตรา 40(4) สำหรับยื่นภาษี นโยบายนี้อธิบายว่าเราเก็บข้อมูลอะไร ใช้ทำอะไร ให้ใครเห็นบ้าง และคุณมีสิทธิอะไรตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)",
    en: "beond (“we”) is an app for retail bond investors: it collects Thai withholding-tax certificates (50 ทวิ) and prepares the section 40(4) figures needed to file a tax return. This policy explains what we collect, why, who else sees it, and what rights you have under Thailand's Personal Data Protection Act B.E. 2562 (PDPA).",
  },
  s_collect: { th: "1. ข้อมูลที่เราเก็บ", en: "1. What we collect" },
  s_purpose: { th: "2. วัตถุประสงค์และฐานทางกฎหมาย", en: "2. Purposes and legal basis" },
  s_share: { th: "3. ผู้ให้บริการภายนอกที่เห็นข้อมูล", en: "3. Third parties that process your data" },
  shareNote: {
    th: `ผู้ให้บริการต่างประเทศระบุเป็นประเภท ส่วนหน่วยงานในไทยระบุชื่อจริง หากต้องการทราบรายชื่อผู้ประมวลผลที่ใช้อยู่ในปัจจุบันทั้งหมด ขอได้ทางอีเมล ${SUPPORT_EMAIL} ผู้ให้บริการทุกรายประมวลผลตามคำสั่งของเราเท่านั้น และไม่นำข้อมูลของคุณไปใช้เพื่อวัตถุประสงค์ของตนเอง`,
    en: `Overseas providers are listed by category; Thai agencies by name. Email ${SUPPORT_EMAIL} if you want the current vendor list. Every processor acts on our instructions only and does not use your data for its own purposes.`,
  },
  s_cross: { th: "4. การส่งข้อมูลไปต่างประเทศ", en: "4. Cross-border transfers" },
  s_keep: { th: "5. ระยะเวลาเก็บและการลบข้อมูล", en: "5. Retention and deletion" },
  s_secure: { th: "6. ความปลอดภัย", en: "6. Security" },
  s_rights: { th: "7. สิทธิของคุณ", en: "7. Your rights" },
  s_cookies: { th: "8. คุกกี้และข้อมูลที่เก็บในเบราว์เซอร์", en: "8. Cookies and browser storage" },
  s_ext: { th: "9. ส่วนขยายเบราว์เซอร์ beond", en: "9. The beond browser extension" },
  s_minors: { th: "10. ผู้เยาว์", en: "10. Minors" },
  s_change: { th: "11. การเปลี่ยนแปลงนโยบาย", en: "11. Changes to this policy" },
  s_contact: { th: "12. ติดต่อเรา", en: "12. Contact us" },
  purpose: {
    th: [
      "ให้บริการตามที่คุณขอ — เก็บสลิป คำนวณดอกเบี้ยและภาษีที่ถูกหักไว้ และสรุปยอดสำหรับยื่นภาษี (ฐาน: การปฏิบัติตามสัญญา)",
      "อ่านข้อมูลจากภาพสลิปด้วยระบบ AI ของผู้ให้บริการภายนอก เพื่อไม่ต้องพิมพ์เอง (ฐาน: การปฏิบัติตามสัญญา และความยินยอมที่คุณให้ก่อนส่งภาพครั้งแรก)",
      "ส่งข้อความแจ้งเตือนผ่าน LINE เช่น ยืนยันการบันทึกสลิป และเตือนงวดดอกเบี้ยที่ยังไม่ได้เก็บ (ฐาน: ความยินยอม ถอนได้ทุกเมื่อโดยบล็อกบัญชีทางการ)",
      "ดูแลความปลอดภัย ป้องกันการใช้งานผิดวัตถุประสงค์ และปรับปรุงบริการ (ฐาน: ประโยชน์อันชอบด้วยกฎหมาย)",
    ],
    en: [
      "Running the service you asked for — storing slips, computing interest and tax withheld, and totalling it for your return (basis: performance of a contract)",
      "Reading your slip images with a third-party AI service so you do not have to type them (basis: contract, plus the consent you give before the first image is sent)",
      "Sending LINE notifications such as save confirmations and reminders for interest periods you have not collected (basis: consent — withdraw any time by blocking the official account)",
      "Security, abuse prevention and service improvement (basis: legitimate interest)",
    ],
  },
  cross: {
    th: "ผู้ให้บริการบางรายอยู่นอกประเทศไทย ตามตารางข้างต้น การส่งภาพสลิปไปให้ระบบ AI อ่าน และการเก็บข้อมูลไว้บนคลาวด์ จึงเป็นการส่งข้อมูลออกนอกราชอาณาจักร เราเลือกผู้ให้บริการที่มีมาตรการคุ้มครองข้อมูลตามมาตรฐานสากลและมีข้อตกลงประมวลผลข้อมูล และเราจะขอความยินยอมจากคุณก่อนส่งภาพสลิปครั้งแรก",
    en: "Some processors are outside Thailand, as listed above. Sending a slip image for AI reading and storing your records in the cloud are therefore cross-border transfers. We choose processors with recognised safeguards and data-processing agreements, and we ask for your consent before the first slip image is sent.",
  },
  keep: {
    th: [
      "เราเก็บข้อมูลของคุณไว้ตราบเท่าที่บัญชียังใช้งานอยู่ เพราะการยื่นภาษีย้อนหลังต้องอาศัยข้อมูลของปีก่อน ๆ",
      "คุณลบบัญชีได้เองจาก ตั้งค่า → ลบบัญชี การลบจะลบภาพสลิปทั้งหมดออกจากที่เก็บไฟล์ พร้อมทั้งพอร์ต รายการดอกเบี้ย เอกสารภาษี และข้อมูลบัญชีของคุณ",
      "สำเนาสำรอง (backup) ของผู้ให้บริการฐานข้อมูลอาจยังคงอยู่ได้ไม่เกิน 30 วันก่อนถูกเขียนทับตามรอบปกติ",
      "ภาพที่ส่งให้ระบบ AI อ่านจะไม่ถูกนำไปใช้ฝึกโมเดล ตามเงื่อนไขบริการแบบเสียค่าบริการที่เราใช้",
    ],
    en: [
      "We keep your data while your account is active, because filing for an earlier year needs that year's records.",
      "You can delete your account yourself under Settings → Delete account. That removes every slip image from storage along with your portfolio, payouts, tax documents and account row.",
      "Provider backups may retain a copy for up to 30 days before they are rotated out.",
      "Images sent for AI reading are not used to train models, under the paid service terms we use.",
    ],
  },
  secure: {
    th: [
      "การเชื่อมต่อทั้งหมดเข้ารหัสด้วย HTTPS",
      "ฐานข้อมูลเปิด Row Level Security ทุกตาราง แถวของคุณอ่านได้เฉพาะเซสชันของคุณเอง",
      "กุญแจที่มีสิทธิสูงอยู่ในฟังก์ชันฝั่งเซิร์ฟเวอร์เท่านั้น ไม่เคยส่งมาที่เบราว์เซอร์",
      "ภาพสลิปเก็บในที่เก็บไฟล์แบบไม่เปิดสาธารณะ เข้าถึงได้ผ่านลิงก์ชั่วคราวที่ผูกกับบัญชีคุณ",
    ],
    en: [
      "All connections are encrypted with HTTPS.",
      "Every database table has Row Level Security; your rows are readable only by your own session.",
      "Privileged keys live in server-side functions only and never reach the browser.",
      "Slip images sit in a private bucket, reachable only through short-lived links tied to your account.",
    ],
  },
  rights: {
    th: [
      "ขอเข้าถึงและขอสำเนาข้อมูลของคุณ",
      "ขอแก้ไขข้อมูลที่ไม่ถูกต้อง (แก้ได้เองในแอปเป็นส่วนใหญ่)",
      "ขอลบข้อมูล (ทำได้เองจาก ตั้งค่า → ลบบัญชี)",
      "ขอให้ระงับการใช้ข้อมูล คัดค้านการประมวลผล หรือขอให้โอนย้ายข้อมูล",
      "ถอนความยินยอมที่เคยให้ไว้ โดยไม่กระทบการประมวลผลที่ทำไปแล้ว",
      "ร้องเรียนต่อสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล (สคส.) หากเห็นว่าเราทำไม่ถูกต้อง",
    ],
    en: [
      "Access your data and obtain a copy",
      "Correct inaccurate data (most of it is editable in the app)",
      "Erase your data (self-service under Settings → Delete account)",
      "Restrict or object to processing, and request portability",
      "Withdraw a consent you gave, without affecting processing already carried out",
      "Complain to Thailand's Personal Data Protection Committee (PDPC) if you believe we are in the wrong",
    ],
  },
  rightsHow: {
    th: `ใช้สิทธิได้โดยอีเมลถึง ${SUPPORT_EMAIL} หรือทักบัญชีทางการ ${LINE_OA} เราจะตอบภายใน 30 วัน`,
    en: `To exercise a right, email ${SUPPORT_EMAIL} or message ${LINE_OA} on LINE. We respond within 30 days.`,
  },
  cookies: {
    th: [
      "เราไม่ใช้คุกกี้เพื่อโฆษณาหรือติดตามข้ามเว็บไซต์",
      "เบราว์เซอร์ของคุณเก็บโทเคนเซสชันไว้เพื่อให้ไม่ต้องเข้าสู่ระบบใหม่ทุกครั้ง และเก็บภาษาที่เลือกไว้",
      "Vercel Analytics และ Speed Insights เก็บสถิติหน้าเว็บแบบไม่ระบุตัวตน ไม่ผูกกับบัญชีของคุณ",
    ],
    en: [
      "We use no advertising or cross-site tracking cookies.",
      "Your browser holds a session token so you are not asked to sign in on every visit, plus your language choice.",
      "Vercel Analytics and Speed Insights record anonymous page metrics that are not linked to your account.",
    ],
  },
  ext: {
    th: [
      "ส่วนขยาย “beond — e-Filing autofill” ช่วยกรอกเงินได้มาตรา 40(4) ลงแบบยื่นภาษีบน efiling.rd.go.th จากตัวเลขที่คุณยืนยันไว้ในแอปแล้ว",
      "ส่วนขยายทำงานเฉพาะบนหน้าเว็บของ beond และบน efiling.rd.go.th เท่านั้น",
      "ข้อมูลที่ส่งเข้าส่วนขยายถูกเก็บไว้ใน chrome.storage.local บนเครื่องของคุณ ส่วนขยายไม่ส่งข้อมูลออกไปยังเซิร์ฟเวอร์ใดทั้งสิ้น ไม่ว่าของเราหรือของบุคคลที่สาม",
      "ส่วนขยายไม่อ่านหน้าเว็บอื่น ไม่เก็บประวัติการเข้าชม และไม่โหลดโค้ดจากภายนอกมารัน",
      "ถอนการติดตั้งส่วนขยายจะลบข้อมูลที่เก็บไว้ในเครื่องทั้งหมด",
    ],
    en: [
      "The “beond — e-Filing autofill” extension fills the section 40(4) income you already confirmed in the app into the return on efiling.rd.go.th.",
      "It runs only on beond's own pages and on efiling.rd.go.th.",
      "The rows you send to it are held in chrome.storage.local on your machine. The extension transmits nothing to any server, ours or anyone else's.",
      "It does not read other sites, does not record browsing history, and loads no remote code.",
      "Uninstalling the extension deletes everything it stored locally.",
    ],
  },
  minors: {
    th: "บริการนี้มีไว้สำหรับผู้ที่ลงทุนในหุ้นกู้และยื่นภาษีด้วยตนเอง เราไม่ได้ตั้งใจเก็บข้อมูลของผู้ที่อายุต่ำกว่า 20 ปีโดยไม่มีความยินยอมของผู้ปกครอง หากพบว่ามีข้อมูลดังกล่าว กรุณาแจ้งเราเพื่อลบออก",
    en: "The service is meant for people who invest in bonds and file their own returns. We do not knowingly collect data from anyone under 20 without a guardian's consent; tell us if we have and we will delete it.",
  },
  change: {
    th: "หากมีการเปลี่ยนแปลงที่มีนัยสำคัญ เช่น เพิ่มผู้ประมวลผลรายใหม่ หรือเปลี่ยนวัตถุประสงค์ เราจะปรับวันที่มีผลด้านบนและแจ้งให้ทราบในแอปหรือทาง LINE ก่อนเริ่มใช้",
    en: "If something material changes — a new processor, a new purpose — we update the effective date above and tell you in the app or on LINE before it takes effect.",
  },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-medium text-[#1B1C1D]">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-7 text-black/70">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 marker:text-black/30">
      {items.map((s) => (
        <li key={s}>{s}</li>
      ))}
    </ul>
  );
}

export default function PrivacyPolicy() {
  const [lang, setLang] = useState<Lang>("th");
  const t = <K extends keyof typeof T>(k: K) => T[k][lang] as (typeof T)[K][Lang];

  return (
    <main className="min-h-svh bg-[#F0F2F5] px-5 py-12 lg:px-12">
      <div className="mx-auto w-full max-w-[46rem]">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3" aria-label="beond">
            <span
              className="block h-7 w-auto [&_svg]:h-full [&_svg]:w-auto"
              style={{ ["--fill-0" as string]: "#2968A5" }}
              dangerouslySetInnerHTML={{ __html: wordmark }}
            />
          </a>
          <div className="flex items-center gap-1 rounded-full bg-white p-1 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
            {(["th", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={`rounded-full px-3 py-1 transition hover:bg-black/5 ${
                  lang === l ? "bg-[#43507F] text-white hover:bg-[#43507F]" : "text-black/60"
                }`}
              >
                {l === "th" ? "ไทย" : "EN"}
              </button>
            ))}
          </div>
        </header>

        <article className="mt-10 rounded-3xl bg-white p-7 lg:p-10">
          <h1 className="text-3xl text-[#1B1C1D]">{t("title")}</h1>
          <p className="mt-2 text-sm text-black/45">
            {t("effective")} {EFFECTIVE[lang]} · {t("version")} {VERSION}
          </p>
          <p className="mt-6 text-[15px] leading-7 text-black/70">{t("intro")}</p>

          <Section title={t("s_collect")}>
            {COLLECTED.map((g) => (
              <div key={g.title.en}>
                <h3 className="text-[15px] font-medium text-[#1B1C1D]">{g.title[lang]}</h3>
                <div className="mt-2">
                  <Bullets items={g.items[lang]} />
                </div>
              </div>
            ))}
          </Section>

          <Section title={t("s_purpose")}>
            <Bullets items={T.purpose[lang]} />
          </Section>

          <Section title={t("s_share")}>
            <ul className="divide-y divide-black/5">
              {PROCESSORS.map((p) => (
                <li
                  key={p.name.en}
                  className="py-3 first:pt-0 last:pb-0 sm:grid sm:grid-cols-[11rem_1fr_7rem] sm:gap-4"
                >
                  <span className="block font-medium text-[#1B1C1D]">{p.name[lang]}</span>
                  <span className="mt-1 block text-black/70 sm:mt-0">{p.role[lang]}</span>
                  <span className="mt-1 block text-black/45 sm:mt-0">{p.where[lang]}</span>
                </li>
              ))}
            </ul>
            <p className="pt-2 text-sm text-black/50">{T.shareNote[lang]}</p>
          </Section>

          <Section title={t("s_cross")}>
            <p>{T.cross[lang]}</p>
          </Section>

          <Section title={t("s_keep")}>
            <Bullets items={T.keep[lang]} />
          </Section>

          <Section title={t("s_secure")}>
            <Bullets items={T.secure[lang]} />
          </Section>

          <Section title={t("s_rights")}>
            <Bullets items={T.rights[lang]} />
            <p>{T.rightsHow[lang]}</p>
          </Section>

          <Section title={t("s_cookies")}>
            <Bullets items={T.cookies[lang]} />
          </Section>

          <Section title={t("s_ext")}>
            <Bullets items={T.ext[lang]} />
          </Section>

          <Section title={t("s_minors")}>
            <p>{T.minors[lang]}</p>
          </Section>

          <Section title={t("s_change")}>
            <p>{T.change[lang]}</p>
          </Section>

          <Section title={t("s_contact")}>
            <p>
              beond ·{" "}
              <a className="text-[#2968A5] underline underline-offset-2" href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>{" "}
              · LINE {LINE_OA}
            </p>
          </Section>
        </article>

        <a
          href="/"
          className="mt-8 inline-flex rounded-full bg-white px-4 py-2 text-sm text-black/60 transition hover:bg-black/5"
        >
          ← {t("back")}
        </a>
      </div>
    </main>
  );
}
