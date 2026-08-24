// ThaiBMA bond-feature scraper, shared by the thaibma-feature endpoint and the
// LINE auto-add flow. ThaiBMA has no public JSON API: its Bond Feature page
// authorises the /issue/feature call with a Token+timestamp pair embedded in the
// page HTML plus an X-Requested-With header, and it can't be called from the
// browser (CORS). This runs the handshake server-side and returns a slim
// normalised record used to enrich bonds the SEC catalog doesn't cover.

const TBMA = "https://www.thaibma.or.th";
const TBMA_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

const FREQ_MAP: Record<string, number> = {
  monthly: 12,
  quarterly: 4,
  "semi-annually": 2,
  "semi annually": 2,
  semiannually: 2,
  annually: 1,
  yearly: 1,
};

export async function thaibmaFeature(symbol: string) {
  const pageUrl = `${TBMA}/EN/BondInfo/BondFeature/Issue.aspx?symbol=${encodeURIComponent(symbol)}`;
  const html = await fetch(pageUrl, { headers: { "User-Agent": TBMA_UA } }).then((r) => r.text());
  const token = html.match(/id="token"[^>]*value="([^"]*)"/i)?.[1];
  const time = html.match(/id="time"[^>]*value="([^"]*)"/i)?.[1];
  if (!token || !time) return null;

  const val = (await fetch(`${TBMA}/issue/ValidateSymbol?Symbol=${encodeURIComponent(symbol)}`, {
    headers: { "User-Agent": TBMA_UA, Referer: pageUrl },
  }).then((r) => r.json())) as [string, string];
  if (String(val?.[0]) !== "1") return null;

  const authHeaders = {
    "User-Agent": TBMA_UA,
    Referer: pageUrl,
    "X-Requested-With": "XMLHttpRequest",
    Token: token,
    timestamp: time,
  };
  const id = val[1];
  const feat = await fetch(`${TBMA}/issue/feature?Symbol=${id}`, { headers: authHeaders });
  if (!feat.ok) return null;
  const f = (await feat.json()) as Record<string, unknown>;

  // Coupon rate lives in a separate endpoint; a single fixed-rate row exposes
  // the rate directly, floating/stepped notes only get their reference text.
  let couponRate: number | null = null;
  let couponText: string | null = null;
  try {
    const cp = (await fetch(`${TBMA}/issue/couponpaymentreference?Symbol=${id}`, {
      headers: authHeaders,
    }).then((r) => r.json())) as Array<{ OffsetRate: number; MaxRate: number; MinRate: number; ReferenceText: string }>;
    if (Array.isArray(cp) && cp.length === 1) {
      const c = cp[0];
      couponText = c.ReferenceText ?? null;
      if (c.MaxRate === 0 && c.MinRate === 0 && Number.isFinite(c.OffsetRate) && c.OffsetRate > 0) {
        couponRate = c.OffsetRate;
      }
    } else if (Array.isArray(cp) && cp.length > 1) {
      couponText = "Stepped / floating";
    }
  } catch {
    /* coupon lookup is best-effort */
  }

  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const iso = (v: unknown) => (typeof v === "string" && v ? v.slice(0, 10) : null);
  return {
    symbol: str(f.Symbol) || symbol,
    issuer: str(f.IssueNameEn),
    issueDate: iso(f.IssuedDate),
    maturityDate: iso(f.MaturityDate),
    termYears: typeof f.IssueTerm === "number" ? f.IssueTerm : null,
    isin: str(f.IsinTh) || null,
    frequency: FREQ_MAP[str(f.CouponFrequencyNameEn).toLowerCase()] ?? null,
    couponRate,
    couponText,
  };
}
