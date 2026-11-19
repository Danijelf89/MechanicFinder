import { Mechanic } from '../models/mechanic';
import { TKey, lang, numberLocale, tr } from '../i18n/i18n';

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function formatKm(km: number): string {
  if (km < 1) return Math.max(10, Math.round((km * 1000) / 10) * 10) + ' m';
  return km.toLocaleString(numberLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' km';
}

/** Gruba procena vožnje kroz grad: ~30 km/h, putanja ~30% duža od vazdušne linije. */
export function etaMinutes(km: number): number {
  return Math.max(1, Math.round(((km * 1.3) / 30) * 60));
}

/** "majstor" / "majstora" (sr: 1, 21, 31… su jednina; en: samo 1). */
export function pluralMajstor(n: number): string {
  const one = lang() === 'sr' ? n % 10 === 1 && n % 100 !== 11 : n === 1;
  return tr(one ? 'word.mech.one' : 'word.mech.other');
}

/** OSM opening_hours -> čitljivije redove na izabranom jeziku. */
export function translateHours(hours: string): string[] {
  if (hours.trim() === '24/7') return [tr('hours.always')];
  return hours
    .split(/;\s*/)
    .filter(Boolean)
    .map(line =>
      line
        .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, d => tr(('day.' + d) as TKey))
        .replace(/\boff\b/gi, tr('hours.closed'))
        .replace(/-/g, '–')
    );
}

const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ђ: 'dj', е: 'e', ж: 'z', з: 'z', и: 'i', ј: 'j', к: 'k', л: 'l', љ: 'lj',
  м: 'm', н: 'n', њ: 'nj', о: 'o', п: 'p', р: 'r', с: 's', т: 't', ћ: 'c', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'c',
  џ: 'dz', ш: 's'
};

const CYR_TO_LAT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ђ: 'đ', е: 'e', ж: 'ž', з: 'z', и: 'i', ј: 'j', к: 'k', л: 'l', љ: 'lj',
  м: 'm', н: 'n', њ: 'nj', о: 'o', п: 'p', р: 'r', с: 's', т: 't', ћ: 'ć', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'č',
  џ: 'dž', ш: 'š'
};

/** Srpska ćirilica -> latinica za prikaz (aplikacija je na latinici). */
export function toLatin(s: string): string {
  return s.replace(/[Ѐ-ӿ]/g, (ch, i: number) => {
    const lower = ch.toLowerCase();
    const lat = CYR_TO_LAT[lower];
    if (lat === undefined) return ch;
    if (ch === lower) return lat;
    // Veliko slovo: "Љубав" -> "Ljubav", ali "ЉУБАВ" -> "LJUBAV".
    const next = s[i + 1];
    const nextIsUpper = !!next && next !== next.toLowerCase();
    return nextIsUpper ? lat.toUpperCase() : lat[0].toUpperCase() + lat.slice(1);
  });
}

/** Za pretragu: mala slova, ćirilica -> latinica, bez kvačica (š->s, đ->dj...). */
export function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[а-џ]/g, c => CYR[c] ?? c)
    .replace(/đ/g, 'dj')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function directionsUrl(m: Pick<Mechanic, 'lat' | 'lon'>): string {
  return 'https://www.google.com/maps/dir/?api=1&destination=' + m.lat + ',' + m.lon;
}

export function telUrl(phone: string): string {
  return 'tel:' + phone.split(';')[0].replace(/[^\d+]/g, '');
}

export function websiteUrl(site: string): string {
  return /^https?:\/\//i.test(site) ? site : 'https://' + site;
}

export function websiteHost(site: string): string {
  try {
    return new URL(websiteUrl(site)).hostname.replace(/^www\./, '');
  } catch {
    return site;
  }
}
