import type { Currency, Money } from "./types";

export type Lang = "en" | "bn";

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Converts ASCII digits to Bengali digits. */
export function toBnDigits(s: string): string {
  return s.replace(/\d/g, (d) => BN_DIGITS[Number(d)]!);
}

/** Converts Bengali digits to ASCII (for TrxIDs, phone numbers, OTP typed in Bengali). */
export function fromBnDigits(s: string): string {
  return s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

/** South Asian grouping (1,20,000) for BDT, western grouping otherwise. */
export function groupDigits(n: number, currency: Currency = "BDT"): string {
  const neg = n < 0;
  const s = Math.trunc(Math.abs(n)).toString();
  let out: string;
  if (currency === "BDT" && s.length > 3) {
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    out = `${rest},${last3}`;
  } else {
    out = s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  return neg ? `-${out}` : out;
}

const SYMBOL: Record<Currency, string> = { BDT: "৳", USD: "$" };

export function formatMoney(
  m: Money,
  lang: Lang = "en",
  opts: { decimals?: boolean } = {},
): string {
  const major = m.amountMinor / 100;
  const whole = groupDigits(major, m.currency);
  const frac = Math.abs(m.amountMinor % 100);
  let s = `${SYMBOL[m.currency]}${whole}`;
  if (opts.decimals || frac !== 0) s += `.${String(frac).padStart(2, "0")}`;
  return lang === "bn" ? toBnDigits(s) : s;
}

export function formatNumber(n: number, lang: Lang = "en"): string {
  const s = groupDigits(n);
  return lang === "bn" ? toBnDigits(s) : s;
}

export function bdt(major: number): Money {
  return { amountMinor: Math.round(major * 100), currency: "BDT" };
}

/**
 * Commission split, mirroring the planned ledger rule: the platform share is rounded
 * half-up to whole minor units and the mentor gets the exact remainder, so the two
 * parts always add up to the order amount.
 */
export function splitCommission(
  amountMinor: number,
  rate: number,
): { platformMinor: number; mentorMinor: number } {
  if (!Number.isInteger(amountMinor) || amountMinor < 0)
    throw new RangeError("amountMinor must be a non-negative integer");
  if (!(rate >= 0 && rate <= 1)) throw new RangeError("rate must be between 0 and 1");
  const platformMinor = Math.round(amountMinor * rate);
  return { platformMinor, mentorMinor: amountMinor - platformMinor };
}

export interface CountdownParts {
  overdue: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

export function countdown(deadlineIso: string, nowMs: number): CountdownParts {
  const diff = new Date(deadlineIso).getTime() - nowMs;
  const overdue = diff < 0;
  let s = Math.floor(Math.abs(diff) / 1000);
  const days = Math.floor(s / 86400);
  s -= days * 86400;
  const hours = Math.floor(s / 3600);
  s -= hours * 3600;
  const minutes = Math.floor(s / 60);
  return { overdue, days, hours, minutes, seconds: s - minutes * 60, totalMs: diff };
}

/** Urgency for countdown colouring: < 12 h critical, < 48 h soon. */
export function urgency(
  deadlineIso: string,
  nowMs: number,
): "overdue" | "critical" | "soon" | "ok" {
  const ms = new Date(deadlineIso).getTime() - nowMs;
  if (ms < 0) return "overdue";
  if (ms < 12 * 3600_000) return "critical";
  if (ms < 48 * 3600_000) return "soon";
  return "ok";
}

export function formatDate(iso: string, lang: Lang = "en", withTime = false): string {
  const d = new Date(iso);
  const s = new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Asia/Dhaka",
  }).format(d);
  return s;
}

/** Normalizes a TrxID the way ICTSpark does: Bengali digits → ASCII, uppercase, alphanumerics only. */
export function normalizeTrxId(raw: string): string {
  return fromBnDigits(raw)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function isValidTrxId(raw: string, method: "bkash" | "nagad" | "rocket" | "bank"): boolean {
  const v = normalizeTrxId(raw);
  return method === "bank" ? /^[A-Z0-9]{4,30}$/.test(v) : /^[A-Z0-9]{6,20}$/.test(v);
}

/** Bangladeshi mobile number (01[3-9]XXXXXXXX), accepts +880 / Bengali digits. */
export function normalizeBdMobile(raw: string): string | null {
  const v = fromBnDigits(raw).replace(/\D/g, "").replace(/^880/, "0");
  return /^01[3-9]\d{8}$/.test(v) ? v : null;
}
