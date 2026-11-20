import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { Filter, Mechanic, SERVICE_TYPES, ServiceType, UserLocation } from '../models/mechanic';
import { haversineKm, toLatin } from '../utils/format';
import { GEOAPIFY_KEY } from '../config';
import { tr } from '../i18n/i18n';

/** Geoapify Places API (podaci iz OpenStreetMap-a). */
const PLACES_URL = 'https://api.geoapify.com/v2/places';
const CATEGORIES = 'service.vehicle.repair.car';
/** Maksimum koji Geoapify vraća u jednom zahtevu. */
const LIMIT = 500;
const REQUEST_TIMEOUT_MS = 15000;
/** Pauze pre ponovnih pokušaja (exponential backoff). */
const RETRY_DELAYS_MS = [1500, 4000];

interface GeoapifyFeature {
  properties: {
    lat: number;
    lon: number;
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    place_id: string;
    datasource?: { raw?: Record<string, string | number> };
  };
}

interface GeoapifyResponse {
  features: GeoapifyFeature[];
}

export type LoadStatus = 'idle' | 'loading' | 'error' | 'ready';
/** blizina = samo po udaljenosti; otvoreni = prvo otvoreni, pa nepoznato, pa zatvoreni (unutar grupe po udaljenosti). */
export type SortMode = 'blizina' | 'otvoreni';

@Injectable({ providedIn: 'root' })
export class MechanicService {
  private readonly http = inject(HttpClient);
  private lastKey = '';
  private custom?: Promise<CustomMechanic[]>;

  readonly mechanics = signal<Mechanic[]>([]);
  readonly status = signal<LoadStatus>('idle');
  /** Filter i radijus žive ovde da bi se sačuvali pri povratku sa profila. */
  readonly filter = signal<Filter>('svi');
  readonly radius = signal<number>(5);
  readonly sort = signal<SortMode>('blizina');
  /** Ručna pretraga po nazivu/adresi. */
  readonly query = signal('');

  async load(loc: UserLocation, radiusKm: number, force = false): Promise<void> {
    const key = loc.lat.toFixed(4) + ',' + loc.lon.toFixed(4) + ',' + radiusKm;
    if (!force && key === this.lastKey && this.status() !== 'error') return;
    this.lastKey = key;
    this.status.set('loading');

    const params = new HttpParams()
      .set('categories', CATEGORIES)
      .set('filter', 'circle:' + loc.lon + ',' + loc.lat + ',' + Math.round(radiusKm * 1000))
      .set('bias', 'proximity:' + loc.lon + ',' + loc.lat)
      .set('limit', LIMIT)
      .set('apiKey', GEOAPIFY_KEY);

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0) {
        await sleep(RETRY_DELAYS_MS[attempt - 1]);
        if (key !== this.lastKey) return;
      }
      try {
        const res = await firstValueFrom(
          this.http.get<GeoapifyResponse>(PLACES_URL, { params }).pipe(timeout(REQUEST_TIMEOUT_MS))
        );
        const custom = (await this.customList()).map(c => customToMechanic(c, loc)).filter(m => m.distanceKm <= radiusKm);
        if (key !== this.lastKey) return; // stigao je noviji zahtev
        const seen = new Set<string>();
        const osm = res.features
          .map(f => toMechanic(f, loc))
          .filter(m => (seen.has(m.id) ? false : (seen.add(m.id), true)))
          // Ručno dodat majstor ima prednost: OSM unos iste vrste na istom mestu je verovatno ista radnja.
          .filter(m => !custom.some(c => c.type === m.type && haversineKm(c.lat, c.lon, m.lat, m.lon) < SAME_PLACE_KM));
        const list = [...custom, ...osm].sort((a, b) => a.distanceKm - b.distanceKm);
        this.mechanics.set(list);
        this.status.set('ready');
        return;
      } catch {
        if (key !== this.lastKey) return;
      }
    }
    if (key === this.lastKey) this.status.set('error');
  }

  /** Ručno dodati majstori iz public/majstori.json; učitavaju se jednom. Greška ne sme da pokvari OSM listu. */
  private customList(): Promise<CustomMechanic[]> {
    this.custom ??= firstValueFrom(this.http.get<CustomMechanic[]>(CUSTOM_URL).pipe(timeout(REQUEST_TIMEOUT_MS))).catch(
      () => {
        this.custom = undefined; // probaj ponovo pri sledećem učitavanju
        return [];
      }
    );
    return this.custom;
  }
}

/** Ručno dodati majstori (public/majstori.json). */
const CUSTOM_URL = 'majstori.json';
/** Udaljenost na kojoj se OSM unos smatra istom radnjom kao ručno dodat. */
const SAME_PLACE_KM = 0.05;

interface CustomMechanic {
  id: string;
  name: string;
  type: ServiceType;
  lat: number;
  lon: number;
  address?: string;
  phone?: string;
  /** OSM format, npr. "Mo-Fr 09:00-18:00; Sa 09:00-15:00" */
  hours?: string;
  website?: string;
}

function customToMechanic(c: CustomMechanic, loc: UserLocation): Mechanic {
  return {
    id: 'custom-' + c.id,
    name: c.name,
    type: SERVICE_TYPES[c.type] ? c.type : 'mehanicar',
    lat: c.lat,
    lon: c.lon,
    distanceKm: haversineKm(loc.lat, loc.lon, c.lat, c.lon),
    address: c.address,
    phone: c.phone,
    hours: c.hours,
    website: c.website
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function classify(t: Record<string, string>): ServiceType {
  const text = ((t['name'] ?? '') + ' ' + (t['name:sr-Latn'] ?? '') + ' ' + (t['description'] ?? '')).toLowerCase();
  if (t['shop'] === 'tyres' || /vulkaniz|gume|guma|tyre|tire|вулканиз|гуме|гума/.test(text)) return 'vulkanizer';
  if (t['service:vehicle:body_repair'] === 'yes' || /limar|karoser|lakir|farbar|лимар|каросер|лакир|фарбар/.test(text)) return 'limar';
  return 'mehanicar';
}

function toMechanic(f: GeoapifyFeature, loc: UserLocation): Mechanic {
  const p = f.properties;
  // Originalni OSM tagovi; vrednosti mogu biti brojevi (npr. housenumber).
  const raw = p.datasource?.raw ?? {};
  const t: Record<string, string> = {};
  for (const k in raw) t[k] = String(raw[k]);

  const type = classify(t);
  const street = [t['addr:street'] ?? p.street, t['addr:housenumber'] ?? p.housenumber].filter(Boolean).join(' ');
  const city = t['addr:city'];
  const address = toLatin([street, city].filter(Boolean).join(', ')) || undefined;
  const osmId = t['osm_type'] && t['osm_id'] ? t['osm_type'] + t['osm_id'] : p.place_id;
  const realName = t['name:sr-Latn'] || t['name'] || p.name;
  const name = realName ? toLatin(realName) : '';
  return {
    id: osmId,
    // Getter: radnja bez imena dobija "Mehaničar (bez naziva)" / "Mechanic (unnamed)" na trenutnom jeziku.
    get name() {
      return name || tr('mech.unnamed', { type: SERVICE_TYPES[type].label });
    },
    type,
    lat: p.lat,
    lon: p.lon,
    distanceKm: haversineKm(loc.lat, loc.lon, p.lat, p.lon),
    address,
    phone: t['phone'] || t['contact:phone'] || t['contact:mobile'] || undefined,
    hours: t['opening_hours'] || undefined,
    website: t['website'] || t['contact:website'] || undefined
  };
}
