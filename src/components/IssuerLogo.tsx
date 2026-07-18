import { Avatar } from "@heroui/react";
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

// HeroUI (Radix) Avatar bound to the issuer's logo; the image fills the whole
// circle, and on load failure it swaps to a color-hashed monogram fallback so
// the UI never breaks.
export default function IssuerLogo({ symbol, name, size = 40, className = "" }: IssuerLogoProps) {
  const url = getIssuerLogoUrl(symbol);
  const color = issuerColor(symbol);
  return (
    <Avatar
      style={{ width: size, height: size }}
      className={`shrink-0 overflow-hidden rounded-full border border-black/10 bg-white ${className}`}
    >
      {url && <Avatar.Image src={url} alt={name} className="h-full w-full object-cover" />}
      <Avatar.Fallback
        style={{ backgroundColor: `${color}1F`, color }}
        className="flex h-full w-full items-center justify-center font-nunito text-sm font-bold"
      >
        {initials(name, symbol)}
      </Avatar.Fallback>
    </Avatar>
  );
}
