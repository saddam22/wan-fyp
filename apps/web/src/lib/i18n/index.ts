import { bn } from "./bn";
import { en, type Messages } from "./en";

export type Lang = "en" | "bn";
export const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "bn", label: "বাংলা" },
];
export const LANG_COOKIE = "ek_lang";
export const DEFAULT_LANG: Lang = "en";

const DICTS: Record<Lang, Messages> = { en, bn };

export function getMessages(lang: Lang): Messages {
  return DICTS[lang];
}

export function isLang(v: unknown): v is Lang {
  return v === "en" || v === "bn";
}

export type { Messages };
