import { Injectable, signal } from '@angular/core';
import { en } from './en';
import { sr, TKey } from './sr';

export type Lang = 'sr' | 'en';
export type { TKey };

export const LANGS: Lang[] = ['sr', 'en'];
const STORAGE_KEY = 'mb.lang';
const DICTS: Record<Lang, Record<TKey, string>> = { sr, en };
const HTML_LANG: Record<Lang, string> = { sr: 'sr-Latn', en: 'en' };
const NUMBER_LOCALE: Record<Lang, string> = { sr: 'sr-Latn-RS', en: 'en-GB' };

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'sr' || saved === 'en') return saved;
  } catch {
    /* storage nedostupan – koristi podrazumevani */
  }
  return 'sr';
}

/**
 * Trenutni jezik. Signal je na nivou modula da bi ga koristile i obične funkcije
 * (format.ts, modeli) – svaki template koji ih pozove automatski se osveži pri promeni.
 */
export const lang = signal<Lang>(initialLang());

/** Prevod po ključu; {ime} u tekstu menja se vrednošću iz params. */
export function tr(key: TKey, params?: Record<string, string | number>): string {
  let s = DICTS[lang()][key] ?? sr[key] ?? key;
  if (params) for (const k in params) s = s.split('{' + k + '}').join(String(params[k]));
  return s;
}

/** Locale za formatiranje brojeva (decimalni zarez/tačka). */
export function numberLocale(): string {
  return NUMBER_LOCALE[lang()];
}

export function setLang(l: Lang): void {
  lang.set(l);
  try {
    localStorage.setItem(STORAGE_KEY, l);
  } catch {
    /* nije kritično */
  }
  applyDocument();
}

/** Usklađuje <html lang> i naslov taba sa izabranim jezikom. */
export function applyDocument(): void {
  document.documentElement.lang = HTML_LANG[lang()];
  document.title = tr('app.title');
}

/** Za komponente: `readonly i = inject(I18n)` pa u template-u `i.t('ključ')`. */
@Injectable({ providedIn: 'root' })
export class I18n {
  readonly lang = lang;
  readonly langs = LANGS;
  t(key: TKey, params?: Record<string, string | number>): string {
    return tr(key, params);
  }
  set(l: Lang): void {
    setLang(l);
  }
}
