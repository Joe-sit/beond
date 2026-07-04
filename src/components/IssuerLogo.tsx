import { useEffect, useState } from "react";
import { getIssuerLogoUrl, issuerColor, issuerTicker } from "../lib/issuerLogo";

// Two-character monogram from the company name (falls back to the ticker).
function initials(name: string, symbol: string): string {
  const cleaned = name.replace(/^(บริษัท|บมจ\.?|บจก\.?)\s*/u, "").trim();
  const base = cleaned || issuerTicker(symbol);
  return base.replace(/\s+/g, "").slice(0, 2).toUpperCase();
}

interface IssuerLogoProps {
  symbol: string;
  name: string;
  size?: number;
  className?: string;
}

// Shows the issuer's SET logo; on load failure it swaps to a color-hashed
// monogram avatar so the UI never breaks.
export default function IssuerLogo({ symbol, name, size = 40, className = "" }: IssuerLogoProps) {
  const [failed, setFailed] = useState(false);

  // Retry the image when the symbol changes (component reuse across rows).
  useEffect(() => setFailed(false), [symbol]);

  const dim = { width: size, height: size };
  const url = getIssuerLogoUrl(symbol);

  if (failed || !url) {
    const color = issuerColor(symbol);
    return (
      <div
        style={{ ...dim, backgroundColor: `${color}1F`, color }}
        className={`flex shrink-0 items-center justify-center rounded-full border border-black/10 font-nunito text-sm font-bold ${className}`}
      >
        {initials(name, symbol)}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={name}
      style={dim}
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full border border-black/10 bg-white object-contain p-0.5 ${className}`}
    />
  );
}
