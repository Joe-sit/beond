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
  const cleaned = fallback
    .replace(/^(บริษัท|บมจ\.?|บจก\.?)\s*/u, "")
    .replace(/\s*จำกัด\s*(\(มหาชน\))?\s*$/u, "")
    .trim();
  return cleaned || fallback || ticker;
}
