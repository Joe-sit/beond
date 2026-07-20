// Company logo helpers using SET's public direct-link endpoint.
import { DISCOVERED_DOMAINS } from "../data/issuerDomains";

// Bond symbols are ISSUER_TICKER + numbers + optional series letters:
//   BRI267A -> BRI, SIRI288B -> SIRI, CPALL266A -> CPALL.
// The issuer ticker is the leading alphabetic run.
export function issuerTicker(symbol: string): string {
  return (symbol.match(/^[A-Za-z]+/)?.[0] ?? symbol).toUpperCase();
}

// Issuer ticker -> company website domain. SET's own logo endpoints are dead /
// bot-blocked, so real logos come from logo.dev: by domain when we know it
// (reliable), else by ticker (logo.dev's own DB, partial for SET), else a
// monogram. Domains cover SET50 + the common corporate-bond issuers.
const ISSUER_DOMAINS: Record<string, string> = {
  // Energy & utilities
  PTT: "pttplc.com", PTTEP: "pttep.com", PTTGC: "pttgcgroup.com",
  GULF: "gulf.co.th", GPSC: "gpscgroup.com", EA: "energyabsolute.co.th",
  BGRIM: "bgrimmpower.com", RATCH: "ratch.co.th", EGCO: "egco.com",
  BANPU: "banpu.com", BCP: "bangchak.co.th", TOP: "thaioilgroup.com",
  IRPC: "irpc.co.th", OR: "pttor.com", SPRC: "sprc.co.th",
  // Banks & finance
  SCB: "scb.co.th", KBANK: "kasikornbank.com", BBL: "bangkokbank.com",
  KTB: "krungthai.com", BAY: "krungsri.com", TTB: "ttbbank.com",
  TISCO: "tisco.co.th", KKP: "kkpfg.com", TCAP: "thanachart.co.th",
  MTC: "muangthaicap.com", SAWAD: "sawad.co.th", KTC: "ktc.co.th",
  // Property & construction
  ORI: "origin.co.th", SIRI: "sansiri.com", AP: "apthai.com",
  SPALI: "supalai.com", QH: "qh.co.th", PSH: "psh.co.th",
  BRI: "britania.co.th", SC: "scasset.com", ANAN: "ananda.co.th",
  PRIN: "prinsiri.com",
  LH: "lh.co.th", LPN: "lpn.co.th", NOBLE: "noblehome.com",
  SCC: "scg.com", SCGP: "scgpackaging.com", TOA: "toagroup.com",
  CPN: "cpn.co.th", CRC: "centralretail.com", WHA: "wha-group.com",
  AMATA: "amata.com", STEC: "stecon.co.th", CK: "ch-karnchang.co.th",
  // Commerce & consumer
  CPALL: "cpall.co.th", CPF: "cpfoods.com", MAKRO: "siammakro.co.th",
  BJC: "bjc.co.th", HMPRO: "homepro.co.th", GLOBAL: "globalhouse.co.th",
  TU: "thaiunion.com", OSP: "osotspa.com", CBG: "carabao.co.th",
  // Transport, health, telecom, industrial, tourism
  AOT: "airportthai.co.th", BEM: "bemplc.co.th", BTS: "btsgroup.co.th",
  BTSG: "btsgroup.co.th", BDMS: "bdms.co.th", BH: "bumrungrad.com",
  ADVANC: "ais.th", TRUE: "truecorp.co.th", INTUCH: "intouchcompany.com",
  MINT: "minor.com", CENTEL: "centarahotelsresorts.com", ERW: "theerawan.com",
  IVL: "indoramaventures.com", DELTA: "deltathailand.com", KCE: "kcethai.com",
  // State enterprises, banks & institutions
  EGAT: "egat.co.th", GHB: "ghbank.co.th", BAAC: "baac.or.th",
  EXIM: "exim.go.th", LHBANK: "lhbank.co.th", LHFG: "lhfg.co.th",
  // Securities & leasing/finance
  KGI: "kgieworld.co.th", YUANTA: "yuanta.co.th", ASK: "ask.co.th",
  JMT: "jmtnetwork.co.th",
  // Property, REITs & construction
  FPT: "frasersproperty.co.th", FTREIT: "frasersproperty.co.th",
  MQDC: "mqdc.com", DTP: "dtgo.com", CPNREIT: "cpn.co.th",
  CWTTH: "chewathai.com", UNIQ: "unique-cons.com",
  // Consumer, agri & industrial
  CPFTH: "cpfoods.com", MPSC: "mitrphol.com", STA: "sritranggroup.com",
  LOTUSS: "lotuss.com", NER: "nerubber.com", TPIPP: "tpipolene.co.th",
  // Energy, utilities, transport & telecom
  PTTC: "pttplc.com", EASTW: "eastwater.com",
  WHART: "wha-group.com", WHAUP: "wha-group.com",
  DTN: "truecorp.co.th", TUC: "truecorp.co.th", TAA: "airasia.com",
};

const LOGODEV_TOKEN = import.meta.env.VITE_LOGODEV_TOKEN as string | undefined;

// Real company logo via logo.dev — by domain when mapped, else by ticker. Uses
// fallback=404 so unknown issuers error out and the UI shows a monogram
// instead of logo.dev's generic placeholder. null when no token is configured.
export function getIssuerLogoUrl(symbol: string): string | null {
  if (!LOGODEV_TOKEN) return null;
  const ticker = issuerTicker(symbol);
  // Manual map wins (hand-verified); then the auto-discovered domain; else fall
  // back to logo.dev's own ticker DB.
  const path = ISSUER_DOMAINS[ticker] ?? DISCOVERED_DOMAINS[ticker] ?? `ticker/${ticker}`;
  return `https://img.logo.dev/${path}?token=${LOGODEV_TOKEN}&size=80&format=png&retina=true&fallback=404`;
}

// Stable brand-ish color per ticker so every issuer (all of SEC, not just the
// mapped ones) gets a distinct, consistent monogram avatar.
const AVATAR_PALETTE = [
  "#4A5AA8", "#5990D7", "#2FA8AD", "#5FB865",
  "#E0991B", "#E8763A", "#D95F8A", "#9B6FD0",
];

export function issuerColor(symbol: string): string {
  const t = issuerTicker(symbol);
  let hash = 0;
  for (let i = 0; i < t.length; i++) hash = (hash * 31 + t.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

// Canonical issuer display name per ticker, so the same company always reads
// the same in the UI regardless of how its bond was added (short seed name vs
// SEC's full legal name).
const ISSUER_NAMES: Record<string, string> = {
  BRI: "บริทาเนีย",
  BTSG: "บีทีเอส กรุ๊ป",
  GULF: "กัลฟ์ เอ็นเนอร์จี",
  KBANK: "กสิกรไทย",
  ORI: "ออริจิ้น พร็อพเพอร์ตี้",
  SIRI: "แสนสิริ",
  CPALL: "ซีพี ออลล์",
  CPF: "ซีพีเอฟ",
  TRUE: "ทรู คอร์ปอเรชั่น",
  BEM: "ทางด่วนและรถไฟฟ้ากรุงเทพ",
  MINT: "ไมเนอร์ อินเตอร์เนชั่นแนล",
};

// Resolve a clean, consistent issuer name: known ticker → curated name;
// otherwise strip Thai legal prefixes/suffixes from the raw name.
export function issuerName(symbol: string, fallback = ""): string {
  const ticker = issuerTicker(symbol);
  if (ISSUER_NAMES[ticker]) return ISSUER_NAMES[ticker];
  const cleaned = cleanCompanyName(fallback);
  return cleaned || fallback || ticker;
}

// Strip Thai legal wrappers so "บริษัท บีทีเอส กรุ๊ป โฮลดิงส์ จำกัด (มหาชน)"
// reads as "บีทีเอส กรุ๊ป โฮลดิงส์".
export function cleanCompanyName(name: string): string {
  return name
    .replace(/^(บริษัท|บมจ\.?|บจก\.?)\s*/u, "")
    .replace(/\s*จำกัด\s*(\(มหาชน\))?\s*$/u, "")
    .trim();
}

// Extra name keywords → ticker, for issuers whose curated ISSUER_NAMES entry
// doesn't cover every legal-name variant (e.g. "โฮลดิงส์"), matched by substring.
const NAME_TICKER_ALIASES: [RegExp, string][] = [
  [/บีทีเอส/, "BTSG"],
  [/บริทาเนีย/, "BRI"],
  [/ออริจิ้น/, "ORI"],
  [/แสนสิริ/, "SIRI"],
  [/กัลฟ์/, "GULF"],
  [/ซีพี\s*ออลล์|ซีพีออลล์/, "CPALL"],
  [/เจริญโภคภัณฑ์อาหาร/, "CPF"],
  [/ทรู\s*คอร์ปอเรชั่น|ทรูคอร์ป/, "TRUE"],
  [/ไมเนอร์/, "MINT"],
  [/ทางด่วนและรถไฟฟ้า/, "BEM"],
];

// Map a payer company name (e.g. from a slip that omits the bond code) to an
// issuer ticker, so it still resolves to the right logo + display name. Matches
// the curated Thai names first, then the alias keywords.
export function issuerTickerFromName(name: string | null | undefined): string | null {
  if (!name) return null;
  for (const [ticker, th] of Object.entries(ISSUER_NAMES)) {
    if (name.includes(th)) return ticker;
  }
  for (const [re, ticker] of NAME_TICKER_ALIASES) {
    if (re.test(name)) return ticker;
  }
  return null;
}

// Juristic (13-digit) tax id → issuer ticker. Client-side OCR reads Thai company
// names poorly but reads the numeric tax id reliably, so this is the robust way
// to resolve the paying company + its logo when a slip omits the bond code.
// Curated like ISSUER_DOMAINS — extend as new issuers appear.
const ISSUER_TAX_IDS: Record<string, string> = {
  "0107536000421": "BTSG", // บีทีเอส กรุ๊ป โฮลดิงส์
  "0107557000381": "ORI", // ออริจิ้น พร็อพเพอร์ตี้
  "0107564000294": "BRI", // บริทาเนีย
};

export function issuerTickerFromTaxId(taxId: string | null | undefined): string | null {
  if (!taxId) return null;
  return ISSUER_TAX_IDS[taxId.replace(/\D/g, "")] ?? null;
}
