/**
 * Pojednostavljen parser OSM `opening_hours` formata.
 * Podržava najčešće oblike: "24/7", "Mo-Fr 08:00-16:00; Sa 08:00-13:00",
 * "Mo-Fr 08:00-12:00,13:00-17:00", "Su off", pravila bez dana ("08:00-20:00")
 * i rad preko ponoći ("20:00-02:00"). Za sve ostalo (meseci, praznici kao jedini dan,
 * izlazak sunca...) vraća null = nepoznato.
 */

const DAY_INDEX: Record<string, number> = { Mo: 0, Tu: 1, We: 2, Th: 3, Fr: 4, Sa: 5, Su: 6 };
const DAY = '(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)';
const DAY_SELECTOR = new RegExp('^' + DAY + '(?:-' + DAY + ')?(?:\\s*,\\s*' + DAY + '(?:-' + DAY + ')?)*');
const TIME_RANGE = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\+?$/;

type Range = [number, number]; // minuti od ponoći, end može biti > 1440 (preko ponoći)
type Week = Range[][]; // 7 dana, Mo = 0

const cache = new Map<string, Week | null>();

function parse(hours: string): Week | null {
  const src = hours.trim();
  if (cache.has(src)) return cache.get(src)!;
  const week = parseUncached(src);
  cache.set(src, week);
  return week;
}

function parseUncached(src: string): Week | null {
  if (/^24\/7$/.test(src)) return Array.from({ length: 7 }, () => [[0, 1440] as Range]);

  const week: Week = Array.from({ length: 7 }, () => []);
  // ";" i "||" razdvajaju pravila; "," takođe kad je ispred vreme/off, a iza dan
  // ("Mo-Fr 08:00-16:00, Sa 08:00-13:00"), ali ne unutar liste dana ("Mo,We,Fr").
  const rules = src
    .split(new RegExp(';|\\|\\||(?<=\\d|off|closed)\\s*,\\s*(?=' + DAY + '\\b)', 'i'))
    .map(r => r.trim())
    .filter(Boolean);
  if (!rules.length) return null;

  for (const rule of rules) {
    let rest = rule;
    let days: number[] = [0, 1, 2, 3, 4, 5, 6];

    const sel = rest.match(DAY_SELECTOR);
    if (sel) {
      days = expandDays(sel[0]);
      rest = rest.slice(sel[0].length).trim();
      // Pravilo samo za praznike ne možemo da primenimo, ali ne kvari ostatak.
      if (!days.length) continue;
    }
    rest = rest.replace(/^:\s*/, '');

    if (/^(off|closed)$/i.test(rest)) {
      for (const d of days) week[d] = [];
      continue;
    }

    const ranges: Range[] = [];
    for (const part of rest.split(/\s*,\s*/)) {
      const m = part.match(TIME_RANGE);
      if (!m) return null;
      const start = +m[1] * 60 + +m[2];
      let end = +m[3] * 60 + +m[4];
      if (end <= start) end += 1440;
      ranges.push([start, end]);
    }
    if (!ranges.length) return null;
    // Kasnije pravilo menja ranija za iste dane (OSM semantika).
    for (const d of days) week[d] = ranges;
  }
  return week;
}

function expandDays(sel: string): number[] {
  const out = new Set<number>();
  for (const part of sel.split(/\s*,\s*/)) {
    const [a, b] = part.split('-');
    if (a === 'PH' || b === 'PH') continue;
    const from = DAY_INDEX[a];
    const to = b ? DAY_INDEX[b] : from;
    for (let i = 0; i < 7; i++) {
      const d = (from + i) % 7;
      out.add(d);
      if (d === to) break;
    }
  }
  return [...out];
}

/** open = radi sada, soon = otvara se za najviše `soonMin` minuta, closed = zatvoreno, null = nepoznato. */
export type OpenStatus = 'open' | 'soon' | 'closed' | null;

export function openStatus(hours: string | undefined, date: Date, soonMin = 60): OpenStatus {
  const open = isOpenAt(hours, date);
  if (open === null) return null;
  if (open) return 'open';
  const week = parse(hours!)!;
  const today = (date.getDay() + 6) % 7;
  const tomorrow = (today + 1) % 7;
  const t = date.getHours() * 60 + date.getMinutes();
  const soon =
    week[today].some(([s]) => s > t && s - t <= soonMin) ||
    week[tomorrow].some(([s]) => s + 1440 - t <= soonMin);
  return soon ? 'soon' : 'closed';
}

/** true = otvoreno, false = zatvoreno, null = nemamo podatak ili ne umemo da ga pročitamo. */
export function isOpenAt(hours: string | undefined, date: Date): boolean | null {
  if (!hours) return null;
  const week = parse(hours);
  if (!week) return null;
  const today = (date.getDay() + 6) % 7;
  const yesterday = (today + 6) % 7;
  const t = date.getHours() * 60 + date.getMinutes();
  if (week[today].some(([s, e]) => t >= s && t < e)) return true;
  // Smena od juče koja prelazi ponoć.
  if (week[yesterday].some(([, e]) => e > 1440 && t < e - 1440)) return true;
  return false;
}
