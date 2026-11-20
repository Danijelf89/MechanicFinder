/**
 * SEO stranice: za svaki grad i vrstu majstora pravi statičnu stranicu (npr. /vulkanizer/novi-sad/)
 * sa spiskom radnji, plus /gradovi/, /privatnost/ i sitemap.xml.
 *
 * Pokreće se posle `ng build`, u GitHub Actions (deploy.yml):
 *   node scripts/seo/generate.mjs dist/majstor-blizu/browser
 *
 * Podaci: OpenStreetMap preko Geoapify Places API-ja (isti izvor kao aplikacija) + public/majstori.json.
 * Ako jedan grad ne uspe da se učita ni posle ponovnih pokušaja, skripta pada – deploy se prekida,
 * a na sajtu ostaje prethodna verzija (bolje nego da stranice nestanu).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CITIES, TYPES } from './cities.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = process.argv[2];
if (!OUT) {
  console.error('Upotreba: node scripts/seo/generate.mjs <dist folder>');
  process.exit(1);
}

const SITE = 'https://servisradar.rs';
/** Adresa za ispravke i uklanjanje radnji. Prazno = deo o kontaktu se ne prikazuje. */
const CONTACT_EMAIL = '';
/** Stranica se pravi samo ako u gradu ima bar ovoliko radnji te vrste (izbegava "tanke" stranice). */
const MIN_SHOPS = 3;
const GEOAPIFY_KEY = readFileSync(join(ROOT, 'src/app/config.ts'), 'utf8').match(/GEOAPIFY_KEY\s*=\s*'([^']+)'/)?.[1];
const TODAY = new Date().toISOString().slice(0, 10);
const TODAY_SR = TODAY.split('-').reverse().join('.') + '.';

// ---------------------------------------------------------------------------
// Podaci
// ---------------------------------------------------------------------------

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchCity(city) {
  const url = new URL('https://api.geoapify.com/v2/places');
  url.search = new URLSearchParams({
    categories: 'service.vehicle.repair.car',
    filter: `circle:${city.lon},${city.lat},${city.radiusKm * 1000}`,
    bias: `proximity:${city.lon},${city.lat}`,
    limit: '500',
    apiKey: GEOAPIFY_KEY
  });
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return (await res.json()).features;
    } catch (e) {
      if (attempt >= 4) throw new Error(`${city.name}: ${e.message}`);
      await sleep(2000 * attempt);
    }
  }
}

/** Isto pravilo kao `classify` u src/app/services/mechanic.service.ts – menjati zajedno. */
function classify(t) {
  const text = ((t['name'] ?? '') + ' ' + (t['name:sr-Latn'] ?? '') + ' ' + (t['description'] ?? '')).toLowerCase();
  if (t['shop'] === 'tyres' || /vulkaniz|gume|guma|tyre|tire|вулканиз|гуме|гума/.test(text)) return 'vulkanizer';
  if (t['service:vehicle:body_repair'] === 'yes' || /limar|karoser|lakir|farbar|лимар|каросер|лакир|фарбар/.test(text)) return 'limar';
  return 'mehanicar';
}

function osmShop(f) {
  const p = f.properties;
  const t = {};
  for (const [k, v] of Object.entries(p.datasource?.raw ?? {})) t[k] = String(v);
  const name = toLatin(t['name:sr-Latn'] || t['name'] || p.name || '').trim();
  const street = [t['addr:street'] ?? p.street, t['addr:housenumber'] ?? p.housenumber].filter(Boolean).join(' ');
  return {
    id: t['osm_type'] && t['osm_id'] ? t['osm_type'] + t['osm_id'] : p.place_id,
    name,
    type: classify(t),
    lat: p.lat,
    lon: p.lon,
    address: toLatin([street, t['addr:city']].filter(Boolean).join(', ')) || undefined,
    phone: t['phone'] || t['contact:phone'] || t['contact:mobile'] || undefined,
    hours: t['opening_hours'] || undefined,
    website: t['website'] || t['contact:website'] || undefined
  };
}

/** Radnje koje ne pripadaju spisku majstora (bez imena, tehnički pregled...). */
function isListable(s) {
  return s.name.length > 1 && !/tehni[cč]ki pregled/i.test(s.name);
}

function km(lat1, lon1, lat2, lon2) {
  const r = d => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

// ---------------------------------------------------------------------------
// Formatiranje
// ---------------------------------------------------------------------------

const CYR_TO_LAT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ђ: 'đ', е: 'e', ж: 'ž', з: 'z', и: 'i', ј: 'j', к: 'k', л: 'l', љ: 'lj',
  м: 'm', н: 'n', њ: 'nj', о: 'o', п: 'p', р: 'r', с: 's', т: 't', ћ: 'ć', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'č',
  џ: 'dž', ш: 'š'
};

function toLatin(s) {
  return s.replace(/[Ѐ-ӿ]/g, (ch, i) => {
    const lower = ch.toLowerCase();
    const lat = CYR_TO_LAT[lower];
    if (lat === undefined) return ch;
    if (ch === lower) return lat;
    const next = s[i + 1];
    return next && next !== next.toLowerCase() ? lat.toUpperCase() : lat[0].toUpperCase() + lat.slice(1);
  });
}

const DAYS = { Mo: 'Pon', Tu: 'Uto', We: 'Sre', Th: 'Čet', Fr: 'Pet', Sa: 'Sub', Su: 'Ned', PH: 'Praznici' };

function hoursLines(h) {
  if (h.trim() === '24/7') return ['Svaki dan, 0–24'];
  return h
    .split(/;\s*/)
    .filter(Boolean)
    .map(l => l.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, d => DAYS[d]).replace(/\boff\b/gi, 'zatvoreno').replace(/-/g, '–'));
}

const esc = s =>
  String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const tel = p => 'tel:' + p.split(';')[0].replace(/[^\d+]/g, '');
const firstPhone = p => p.split(';')[0].trim();
const site = w => (/^https?:\/\//i.test(w) ? w : 'https://' + w);

/** 1 radnja, 2–4 radnje, 5+ radnji (11–14 radnji). */
function radnja(n) {
  const d = n % 10, h = n % 100;
  if (d === 1 && h !== 11) return 'radnja';
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return 'radnje';
  return 'radnji';
}

const pagePath = (type, city) => `/${TYPES[type].slug}/${city.slug}/`;

function mapLink(city, type) {
  const q = new URLSearchParams({ lat: String(city.lat), lon: String(city.lon), mesto: city.name, tip: type });
  return '/mapa?' + q.toString();
}

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

const CSS = `
:root{--ink:#16181b;--ink-2:#55595f;--muted:#7a7e85;--paper:#f5f3ee;--line:#e4e0d7;--accent:#e2501c;--card:#fff}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 'Onest',system-ui,sans-serif}
a{color:var(--accent)}
.wrap{max-width:860px;margin:0 auto;padding:0 16px}
header{background:#fff;border-bottom:1px solid var(--line)}
header .wrap{display:flex;align-items:center;justify-content:space-between;height:64px}
.logo{display:inline-flex;align-items:center;gap:10px;font-weight:800;font-size:19px;color:var(--ink);text-decoration:none;letter-spacing:-.02em}
.logo i{width:32px;height:32px;border-radius:9px;background:var(--accent);display:grid;place-items:center}
.logo svg{width:58%;height:58%;fill:#fff}
.crumbs{font-size:13px;color:var(--muted);margin:22px 0 6px}
.crumbs a{color:var(--muted)}
h1{font-size:clamp(26px,5vw,36px);line-height:1.15;letter-spacing:-.03em;margin:0 0 10px}
.lead{color:var(--ink-2);margin:0 0 18px}
.cta{display:inline-flex;align-items:center;gap:8px;background:var(--ink);color:#fff;text-decoration:none;font-weight:600;padding:12px 18px;border-radius:14px}
.cta:hover{background:#2a2d32}
ol.shops{list-style:none;margin:26px 0;padding:0;display:flex;flex-direction:column;gap:10px}
.shop{background:var(--card);border-radius:16px;padding:16px;display:flex;gap:14px;border:1px solid var(--line)}
.badge{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;font-weight:800;flex:none}
.shop h2{font-size:17px;margin:0 0 4px;line-height:1.3}
.shop p{margin:2px 0;font-size:14px;color:var(--ink-2)}
.shop .hours{font-size:13px;color:var(--muted)}
.shop .acts{margin-top:8px;display:flex;gap:14px;flex-wrap:wrap;font-size:14px;font-weight:600}
.shop .acts a{text-decoration:none}
section.more{margin:30px 0}
section.more h2{font-size:18px;margin:0 0 10px}
.links{display:flex;flex-wrap:wrap;gap:8px}
.links a{background:#fff;border:1px solid var(--line);border-radius:999px;padding:6px 12px;font-size:14px;color:var(--ink);text-decoration:none}
.links a:hover{border-color:var(--ink)}
.cities{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;margin:24px 0}
.city{background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px 16px}
.city h2{font-size:17px;margin:0 0 8px}
.city ul{margin:0;padding:0;list-style:none;font-size:14px;display:flex;flex-direction:column;gap:4px}
.prose{max-width:680px}
.prose h2{font-size:19px;margin:26px 0 8px}
footer{border-top:1px solid var(--line);margin-top:40px;padding:22px 0 40px;font-size:13px;color:var(--muted)}
footer p{margin:4px 0}
footer a{color:var(--ink-2)}
`;

const LOGO_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1 0-1.4z"/></svg>';

function layout({ path, title, description, body, jsonLd }) {
  return `<!doctype html>
<html lang="sr-Latn">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}${path}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="ServisRadar">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}${path}">
<meta property="og:locale" content="sr_RS">
<meta name="theme-color" content="#16181b">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='9' fill='%23e2501c'/%3E%3Cpath transform='translate(6.5 6.5) scale(.8)' fill='white' d='M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1 0-1.4z'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;600;800&display=swap" rel="stylesheet">
<style>${CSS.trim()}</style>
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
${ANALYTICS}
</head>
<body>
<header><div class="wrap"><a class="logo" href="/"><i>${LOGO_SVG}</i>ServisRadar</a><a href="/gradovi/">Svi gradovi</a></div></header>
<main class="wrap">
${body}
</main>
<footer><div class="wrap">
<p>Podaci: © <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap</a> saradnici (ODbL) · Powered by <a href="https://www.geoapify.com/" rel="noopener">Geoapify</a> · ažurirano ${TODAY_SR}</p>
<p>Radno vreme i telefone proverite pre dolaska – podaci mogu biti zastareli.${
    CONTACT_EMAIL ? ` Greška ili želite da vaša radnja bude uklonjena? Pišite na <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.` : ''
  }</p>
<p><a href="/">ServisRadar – mapa majstora</a> · <a href="/gradovi/">Majstori po gradovima</a> · <a href="/privatnost/">Privatnost</a></p>
</div></footer>
</body>
</html>
`;
}

/** Isti Cloudflare Web Analytics kao u src/index.html (token se čita odatle). */
const CF_TOKEN = readFileSync(join(ROOT, 'src/index.html'), 'utf8').match(/CF_TOKEN\s*=\s*'([^']*)'/)?.[1] ?? '';
const ANALYTICS = CF_TOKEN
  ? `<script>(function(){if(!/(^|\\.)servisradar\\.rs$/.test(location.hostname))return;var s=document.createElement('script');s.defer=true;s.src='https://static.cloudflareinsights.com/beacon.min.js';s.setAttribute('data-cf-beacon',JSON.stringify({token:'${CF_TOKEN}'}));document.head.appendChild(s);})();</script>`
  : '';

function shopHtml(s, t) {
  const lines = [];
  if (s.address) lines.push(`<p>${esc(s.address)}</p>`);
  if (s.hours) lines.push(`<p class="hours">${hoursLines(s.hours).map(esc).join(' · ')}</p>`);
  const acts = [];
  if (s.phone) acts.push(`<a href="${esc(tel(s.phone))}">📞 ${esc(firstPhone(s.phone))}</a>`);
  acts.push(`<a href="https://www.google.com/maps/dir/?api=1&amp;destination=${s.lat},${s.lon}" rel="noopener">Navigacija</a>`);
  if (s.website) acts.push(`<a href="${esc(site(s.website))}" rel="noopener nofollow">Sajt</a>`);
  return `<li class="shop"><span class="badge" style="background:${t.tint};color:${t.color}">${t.letter}</span><div>
<h2>${esc(s.name)}</h2>
${lines.join('\n')}
<div class="acts">${acts.join('')}</div>
</div></li>`;
}

function shopJsonLd(s) {
  const o = { '@type': 'AutoRepair', name: s.name, geo: { '@type': 'GeoCoordinates', latitude: s.lat, longitude: s.lon } };
  if (s.address) o.address = { '@type': 'PostalAddress', streetAddress: s.address, addressCountry: 'RS' };
  if (s.phone) o.telephone = firstPhone(s.phone);
  if (s.hours) o.openingHours = s.hours;
  if (s.website) o.url = site(s.website);
  return o;
}

function typePage(city, type, shops, available) {
  const t = TYPES[type];
  const path = pagePath(type, city);
  const n = shops.length;
  const title = `${t.plural} u ${city.loc} – adrese, telefoni i radno vreme | ServisRadar`;
  const description = `${t.plural} u ${city.loc}: ${n} ${radnja(n)} sa adresama, brojevima telefona i radnim vremenom. Pronađite najbližu na mapi i pozovite direktno.`;
  const otherTypes = Object.keys(TYPES)
    .filter(k => k !== type && available.has(k + '|' + city.slug))
    .map(k => `<a href="${pagePath(k, city)}">${TYPES[k].plural} u ${city.loc}</a>`);
  const otherCities = CITIES.filter(c => c !== city && available.has(type + '|' + c.slug)).map(
    c => `<a href="${pagePath(type, c)}">${c.name}</a>`
  );
  const body = `
<p class="crumbs"><a href="/">ServisRadar</a> › <a href="/gradovi/">Gradovi</a> › ${esc(city.name)} › ${esc(t.plural)}</p>
<h1>${esc(t.plural)} u ${esc(city.loc)}</h1>
<p class="lead">Spisak: ${n} ${radnja(n)} u ${esc(city.loc)} i okolini, sa adresom, telefonom i radnim vremenom gde je poznato. Ažurirano ${TODAY_SR}</p>
<a class="cta" href="${esc(mapLink(city, type))}">Prikaži na mapi i nađi najbližeg →</a>
<ol class="shops">
${shops.map(s => shopHtml(s, t)).join('\n')}
</ol>
${otherTypes.length ? `<section class="more"><h2>Još u ${esc(city.loc)}</h2><div class="links">${otherTypes.join('')}</div></section>` : ''}
${otherCities.length ? `<section class="more"><h2>${esc(t.plural)} u drugim gradovima</h2><div class="links">${otherCities.join('')}</div></section>` : ''}
`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${t.plural} u ${city.loc}`,
    numberOfItems: n,
    itemListElement: shops.map((s, i) => ({ '@type': 'ListItem', position: i + 1, item: shopJsonLd(s) }))
  };
  return { path, html: layout({ path, title, description, body, jsonLd }) };
}

function citiesPage(available, counts) {
  const path = '/gradovi/';
  const cards = CITIES.map(c => {
    const items = Object.keys(TYPES)
      .filter(k => available.has(k + '|' + c.slug))
      .map(k => `<li><a href="${pagePath(k, c)}">${TYPES[k].plural}</a> (${counts.get(k + '|' + c.slug)})</li>`);
    return items.length ? `<div class="city"><h2>${esc(c.name)}</h2><ul>${items.join('')}</ul></div>` : '';
  }).join('');
  const body = `
<p class="crumbs"><a href="/">ServisRadar</a> › Gradovi</p>
<h1>Majstori po gradovima</h1>
<p class="lead">Auto servisi, vulkanizeri i limari u gradovima Srbije – adrese, telefoni i radno vreme.</p>
<a class="cta" href="/">Otvori mapu majstora →</a>
<div class="cities">${cards}</div>`;
  return {
    path,
    html: layout({
      path,
      title: 'Majstori po gradovima – auto servisi, vulkanizeri, limari | ServisRadar',
      description: 'Spisak auto servisa, vulkanizera i limara po gradovima Srbije, sa adresama, telefonima i radnim vremenom.',
      body
    })
  };
}

function privacyPage() {
  const path = '/privatnost/';
  const contact = CONTACT_EMAIL
    ? `<p>Za pitanja, ispravke i zahteve za uklanjanje pišite na <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>`
    : '';
  const body = `
<div class="prose">
<p class="crumbs"><a href="/">ServisRadar</a> › Privatnost</p>
<h1>Privatnost</h1>
<h2>Vaša lokacija</h2>
<p>Lokaciju (GPS ili upisanu adresu) koristimo samo da bismo pronašli majstore u blizini. Čuva se u vašem pregledaču dok je tab otvoren i ne šaljemo je na naš server. Radi pretrage se šalje servisima <a href="https://nominatim.org/" rel="noopener">Nominatim</a> (pretvaranje adrese u koordinate) i <a href="https://www.geoapify.com/" rel="noopener">Geoapify</a> (spisak radnji i mapa).</p>
<h2>Statistika poseta</h2>
<p>Posete merimo pomoću Cloudflare Web Analytics, bez kolačića i bez praćenja pojedinačnih korisnika – vidimo samo zbirne brojeve (broj poseta, stranice, zemlje, vrste uređaja).</p>
<h2>Podaci o radnjama</h2>
<p>Spisak radnji potiče iz javne baze <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap</a> (© OpenStreetMap saradnici, ODbL) i od samih radnji. Prikazujemo samo poslovne podatke: naziv, adresu, telefon, radno vreme i sajt.</p>
${contact}
<p>Nemamo korisničke naloge i ne prikupljamo imena, mejlove ni brojeve telefona posetilaca.</p>
</div>`;
  return {
    path,
    html: layout({ path, title: 'Privatnost | ServisRadar', description: 'Kako ServisRadar koristi lokaciju i podatke o radnjama.', body })
  };
}

// ---------------------------------------------------------------------------
// Glavni tok
// ---------------------------------------------------------------------------

if (!GEOAPIFY_KEY) throw new Error('GEOAPIFY_KEY nije pronađen u src/app/config.ts');
const custom = JSON.parse(readFileSync(join(ROOT, 'public/majstori.json'), 'utf8'));

const byCityType = new Map(); // "tip|grad" -> radnje
for (const city of CITIES) {
  const features = await fetchCity(city);
  const seen = new Set();
  const local = custom.filter(c => km(city.lat, city.lon, c.lat, c.lon) <= city.radiusKm);
  const osm = features
    .map(osmShop)
    .filter(s => isListable(s) && !seen.has(s.id) && seen.add(s.id))
    // Ručno dodata radnja ima prednost nad OSM unosom iste vrste na istom mestu (kao u aplikaciji).
    .filter(s => !local.some(c => c.type === s.type && km(c.lat, c.lon, s.lat, s.lon) < 0.05));
  for (const s of [...local, ...osm]) {
    const key = s.type + '|' + city.slug;
    if (!byCityType.has(key)) byCityType.set(key, []);
    byCityType.get(key).push(s);
  }
  console.log(`${city.name.padEnd(18)} ${String(osm.length + local.length).padStart(4)} radnji`);
  await sleep(300);
}

const available = new Set();
const counts = new Map();
for (const [key, shops] of byCityType) {
  if (shops.length >= MIN_SHOPS) {
    available.add(key);
    counts.set(key, shops.length);
  }
}

const pages = [];
for (const [key, shops] of byCityType) {
  if (!available.has(key)) continue;
  const [type, slug] = key.split('|');
  const city = CITIES.find(c => c.slug === slug);
  // Prvo radnje sa telefonom i radnim vremenom (korisnije), pa po nazivu.
  const score = s => (s.phone ? 2 : 0) + (s.hours ? 1 : 0);
  shops.sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name, 'sr'));
  pages.push(typePage(city, type, shops, available));
}
pages.push(citiesPage(available, counts), privacyPage());

for (const p of pages) {
  const file = join(OUT, p.path, 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, p.html);
}

const urls = ['/', ...pages.map(p => p.path)];
writeFileSync(
  join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${SITE}${u}</loc><lastmod>${TODAY}</lastmod></url>`).join('\n')}
</urlset>
`
);

console.log(`\nNapravljeno ${pages.length} stranica (${pages.length - 2} grad/vrsta), sitemap: ${urls.length} adresa.`);
if (!CONTACT_EMAIL) console.warn('UPOZORENJE: CONTACT_EMAIL nije podešen u scripts/seo/generate.mjs – stranice nemaju kontakt za ispravke.');
