// src/components/watchlist/logoResolver.js
import { COMPANY_DOMAINS } from "./companyDomains";

const TOKEN = import.meta.env.VITE_LOGO_DEV_KEY;

export function resolveLogo(symbol) {
  if (!symbol) {
    return { type: "fallback", letter: "?" };
  }

  const sym = symbol.toUpperCase();
  const domain = COMPANY_DOMAINS[sym];

  if (domain && TOKEN) {
    return {
      type: "img",
      src: `https://img.logo.dev/${domain}?token=${TOKEN}`,
    };
  }

  return {
    type: "fallback",
    letter: sym[0],
  };
}
