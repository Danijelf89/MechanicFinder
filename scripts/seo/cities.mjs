/**
 * Gradovi za koje se prave SEO stranice.
 * loc = lokativ ("u ___"), lat/lon = centar grada, radiusKm = krug pretrage oko centra.
 * Novi grad: dodaj red ovde; stranica se pravi samo za vrste sa dovoljno radnji (MIN_SHOPS u generate.mjs).
 */
export const CITIES = [
  { slug: 'beograd', name: 'Beograd', loc: 'Beogradu', lat: 44.8125, lon: 20.4612, radiusKm: 15 },
  { slug: 'novi-sad', name: 'Novi Sad', loc: 'Novom Sadu', lat: 45.2551, lon: 19.8452, radiusKm: 8 },
  { slug: 'nis', name: 'Niš', loc: 'Nišu', lat: 43.3209, lon: 21.8958, radiusKm: 8 },
  { slug: 'kragujevac', name: 'Kragujevac', loc: 'Kragujevcu', lat: 44.0128, lon: 20.9114, radiusKm: 7 },
  { slug: 'subotica', name: 'Subotica', loc: 'Subotici', lat: 46.1005, lon: 19.6651, radiusKm: 7 },
  { slug: 'zrenjanin', name: 'Zrenjanin', loc: 'Zrenjaninu', lat: 45.3816, lon: 20.3903, radiusKm: 6 },
  { slug: 'pancevo', name: 'Pančevo', loc: 'Pančevu', lat: 44.8708, lon: 20.6403, radiusKm: 6 },
  { slug: 'cacak', name: 'Čačak', loc: 'Čačku', lat: 43.8914, lon: 20.3497, radiusKm: 6 },
  { slug: 'kraljevo', name: 'Kraljevo', loc: 'Kraljevu', lat: 43.7258, lon: 20.6894, radiusKm: 6 },
  { slug: 'novi-pazar', name: 'Novi Pazar', loc: 'Novom Pazaru', lat: 43.1367, lon: 20.5122, radiusKm: 5 },
  { slug: 'smederevo', name: 'Smederevo', loc: 'Smederevu', lat: 44.6628, lon: 20.93, radiusKm: 5 },
  { slug: 'leskovac', name: 'Leskovac', loc: 'Leskovcu', lat: 42.9981, lon: 21.9461, radiusKm: 5 },
  { slug: 'valjevo', name: 'Valjevo', loc: 'Valjevu', lat: 44.2751, lon: 19.8982, radiusKm: 5 },
  { slug: 'krusevac', name: 'Kruševac', loc: 'Kruševcu', lat: 43.58, lon: 21.3339, radiusKm: 5 },
  { slug: 'sabac', name: 'Šabac', loc: 'Šapcu', lat: 44.7489, lon: 19.6908, radiusKm: 5 },
  { slug: 'uzice', name: 'Užice', loc: 'Užicu', lat: 43.8586, lon: 19.8488, radiusKm: 5 },
  { slug: 'sombor', name: 'Sombor', loc: 'Somboru', lat: 45.7742, lon: 19.1122, radiusKm: 5 },
  { slug: 'vranje', name: 'Vranje', loc: 'Vranju', lat: 42.5514, lon: 21.9003, radiusKm: 5 },
  { slug: 'sremska-mitrovica', name: 'Sremska Mitrovica', loc: 'Sremskoj Mitrovici', lat: 44.9764, lon: 19.6122, radiusKm: 5 },
  { slug: 'jagodina', name: 'Jagodina', loc: 'Jagodini', lat: 43.9771, lon: 21.2612, radiusKm: 5 }
];

/** Vrste majstora: ključ iz aplikacije -> deo adrese i nazivi na stranici. */
export const TYPES = {
  mehanicar: { slug: 'auto-servis', plural: 'Auto servisi', lower: 'auto servise i mehaničare', letter: 'M', color: '#2e5bd8', tint: '#e3eafc' },
  vulkanizer: { slug: 'vulkanizer', plural: 'Vulkanizeri', lower: 'vulkanizere', letter: 'V', color: '#138a5e', tint: '#dcf3ea' },
  limar: { slug: 'limar', plural: 'Limari', lower: 'limare i auto-lakirere', letter: 'L', color: '#8a3fd1', tint: '#f0e6fb' }
};
