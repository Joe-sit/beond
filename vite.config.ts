import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

// ThaiBMA bond-feature lookup (dev only). ThaiBMA has no public JSON API — its
// Bond Feature page authorises the /issue/feature call with a Token+timestamp
// pair embedded in the page HTML plus an X-Requested-With header, and it can't
// be called from the browser (CORS). This middleware runs the multi-step
// handshake server-side and returns a slim normalised record used to enrich
// manually-added bonds that aren't in the SEC catalog.
// Prod parity lives in a Supabase edge function (see DEPLOY.md).
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

async function thaibmaFeature(symbol: string) {
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

// Registers GET /thaibma-feature?symbol=XXX on the dev server.
function thaibmaProxy(): Plugin {
  return {
    name: "thaibma-feature-proxy",
    configureServer(server) {
      server.middlewares.use("/thaibma-feature", async (req, res) => {
        const symbol = new URL(req.url ?? "", "http://x").searchParams.get("symbol")?.trim();
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        if (!symbol) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "symbol required" }));
          return;
        }
        try {
          const data = await thaibmaFeature(symbol);
          if (!data) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: "not found" }));
            return;
          }
          res.end(JSON.stringify(data));
        } catch (e) {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: String(e) }));
        }
      });
    },
  };
}

// https://vite.dev/config/
// HTTPS is required for LIFF (LINE Login) — endpoint URLs must be https,
// so the dev server runs on https://localhost:5199 with a self-signed cert.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss(), basicSsl(), thaibmaProxy()],
    server: {
      port: 5199,
      // Fail instead of hopping to 5200/5201 when the port is taken: the LIFF
      // endpoint and the LINE Login callback are registered for 5199 only, so a
      // silent fallback starts a server that can't log in.
      strictPort: true,
      // SEC Open Data API proxy: keeps the subscription key server-side
      // (SEC_API_KEY has no VITE_ prefix, so it never reaches the bundle).
      proxy: {
        "/sec-api": {
          target: "https://api.sec.or.th",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/sec-api/, ""),
          headers: {
            "Ocp-Apim-Subscription-Key": env.SEC_API_KEY ?? "",
          },
        },
      },
    },
  };
});
