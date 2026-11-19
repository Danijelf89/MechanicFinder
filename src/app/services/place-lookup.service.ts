import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { GEOAPIFY_KEY } from '../config';
import { toLatin } from '../utils/format';
import { TKey } from '../i18n/i18n';

const GEOCODE_URL = 'https://api.geoapify.com/v1/geocode/search';
const DETAILS_URL = 'https://api.geoapify.com/v2/place-details';
const TIMEOUT_MS = 15000;
/** Koliko daleko od centra grada tražimo radnju. */
const CITY_RADIUS_M = 25000;

export interface Point {
  lat: number;
  lon: number;
}

export interface City extends Point {
  name: string;
}

/** Centri gradova (fiksno, jer geokodiranje imena grada ume da promaši, npr. "Niš"). */
export const CITIES: City[] = [
  { name: 'Beograd', lat: 44.8176, lon: 20.4569 },
  { name: 'Novi Sad', lat: 45.2671, lon: 19.8335 },
  { name: 'Niš', lat: 43.3209, lon: 21.8958 },
  { name: 'Kragujevac', lat: 44.0128, lon: 20.9114 },
  { name: 'Subotica', lat: 46.1003, lon: 19.6658 },
  { name: 'Zrenjanin', lat: 45.3816, lon: 20.3686 },
  { name: 'Pančevo', lat: 44.8708, lon: 20.6403 },
  { name: 'Čačak', lat: 43.8914, lon: 20.3497 },
  { name: 'Kraljevo', lat: 43.7238, lon: 20.6873 },
  { name: 'Novi Pazar', lat: 43.1367, lon: 20.5122 },
  { name: 'Smederevo', lat: 44.6628, lon: 20.93 },
  { name: 'Leskovac', lat: 42.9981, lon: 21.9461 },
  { name: 'Valjevo', lat: 44.2751, lon: 19.8982 },
  { name: 'Kruševac', lat: 43.58, lon: 21.3339 },
  { name: 'Vranje', lat: 42.5514, lon: 21.9003 },
  { name: 'Šabac', lat: 44.7553, lon: 19.694 },
  { name: 'Užice', lat: 43.8586, lon: 19.8488 },
  { name: 'Sombor', lat: 45.7742, lon: 19.1122 },
  { name: 'Požarevac', lat: 44.6213, lon: 21.1878 },
  { name: 'Pirot', lat: 43.1531, lon: 22.5861 },
  { name: 'Zaječar', lat: 43.9042, lon: 22.2847 },
  { name: 'Kikinda', lat: 45.8297, lon: 20.4653 },
  { name: 'Sremska Mitrovica', lat: 44.9764, lon: 19.6122 },
  { name: 'Jagodina', lat: 43.9771, lon: 21.2612 },
  { name: 'Vršac', lat: 45.1167, lon: 21.3036 },
  { name: 'Bor', lat: 44.0749, lon: 22.0959 },
  { name: 'Loznica', lat: 44.5338, lon: 19.2236 },
  { name: 'Inđija', lat: 45.0482, lon: 20.0817 },
  { name: 'Ruma', lat: 45.0081, lon: 19.8222 },
  { name: 'Stara Pazova', lat: 44.985, lon: 20.1608 },
  { name: 'Bačka Palanka', lat: 45.2508, lon: 19.3919 },
  { name: 'Vrbas', lat: 45.5714, lon: 19.64 },
  { name: 'Paraćin', lat: 43.8606, lon: 21.4078 },
  { name: 'Gornji Milanovac', lat: 44.0247, lon: 20.4592 },
  { name: 'Aranđelovac', lat: 44.3069, lon: 20.56 }
];

/** Jedan pogodak pretrage (bez detalja). */
export interface PlaceHit {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
}

export interface PlaceDetails extends PlaceHit {
  /** Ključ prevoda za vrstu radnje. */
  category?: TKey;
  phone?: string;
  email?: string;
  website?: string;
  hours?: string;
}

interface GeoFeature {
  properties: {
    place_id: string;
    name?: string;
    formatted?: string;
    address_line2?: string;
    result_type?: string;
    lat: number;
    lon: number;
    categories?: string[];
    commercial?: { type?: string };
    contact?: { phone?: string; email?: string };
    website?: string;
    opening_hours?: string;
    datasource?: { raw?: Record<string, string | number> };
  };
}

interface GeoResponse {
  features?: GeoFeature[];
}

/** Geoapify kategorija -> ključ prevoda (prevodi se u template-u, pa prati promenu jezika). */
const CATEGORY_LABELS: [string, TKey][] = [
  ['service.vehicle.repair', 'cat.repair'],
  ['service.vehicle.car_wash', 'cat.wash'],
  ['service.vehicle.fuel', 'cat.fuel'],
  ['commercial.vehicle', 'cat.vehicle'],
  ['service.vehicle', 'cat.service']
];

/** Ručna provera: traži radnju po imenu u izabranom gradu i dovlači detalje. */
@Injectable({ providedIn: 'root' })
export class PlaceLookupService {
  private readonly http = inject(HttpClient);

  async search(name: string, center: Point): Promise<PlaceHit[]> {
    const params = new HttpParams()
      .set('text', name)
      .set('filter', 'circle:' + center.lon + ',' + center.lat + ',' + CITY_RADIUS_M)
      .set('bias', 'proximity:' + center.lon + ',' + center.lat)
      .set('limit', 10)
      .set('apiKey', GEOAPIFY_KEY);
    const res = await this.get<GeoResponse>(GEOCODE_URL, params);
    const seen = new Set<string>();
    return (res.features ?? [])
      .map(f => f.properties)
      // Samo radnje/objekti sa imenom, ne ulice i naselja.
      .filter(p => !!p.name && (p.result_type === 'amenity' || p.result_type === 'building'))
      .map(p => ({
        placeId: p.place_id,
        name: toLatin(latinName(p) ?? p.name!),
        address: toLatin(p.address_line2 ?? p.formatted ?? '').replace(/,\s*(Serbia|Srbija)$/, ''),
        lat: p.lat,
        lon: p.lon
      }))
      .filter(h => {
        const k = h.name + '|' + h.lat.toFixed(4) + '|' + h.lon.toFixed(4);
        return seen.has(k) ? false : (seen.add(k), true);
      });
  }

  async details(hit: PlaceHit): Promise<PlaceDetails> {
    const params = new HttpParams().set('id', hit.placeId).set('apiKey', GEOAPIFY_KEY);
    const res = await this.get<GeoResponse>(DETAILS_URL, params);
    const p = res.features?.find(f => (f.properties as { feature_type?: string }).feature_type === 'details')?.properties
      ?? res.features?.[0]?.properties;
    if (!p) return hit;
    const raw = p.datasource?.raw ?? {};
    const t = (k: string) => (raw[k] !== undefined ? String(raw[k]) : undefined);
    return {
      ...hit,
      category: categoryLabel(p.categories ?? []),
      phone: p.contact?.phone ?? t('phone') ?? t('contact:phone') ?? t('contact:mobile'),
      email: p.contact?.email ?? t('email') ?? t('contact:email'),
      website: p.website ?? t('website') ?? t('contact:website'),
      hours: p.opening_hours ?? t('opening_hours')
    };
  }

  private get<T>(url: string, params: HttpParams): Promise<T> {
    return firstValueFrom(this.http.get<T>(url, { params }).pipe(timeout(TIMEOUT_MS)));
  }
}

function latinName(p: GeoFeature['properties']): string | undefined {
  const v = p.datasource?.raw?.['name:sr-Latn'];
  return v !== undefined ? String(v) : undefined;
}

function categoryLabel(cats: string[]): TKey | undefined {
  for (const [prefix, label] of CATEGORY_LABELS) if (cats.some(c => c.startsWith(prefix))) return label;
  return undefined;
}
