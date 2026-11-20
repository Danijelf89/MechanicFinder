import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { UserLocation } from '../models/mechanic';
import { tr } from '../i18n/i18n';

const STORAGE_KEY = 'mb.location';
const NOMINATIM = 'https://nominatim.openstreetmap.org';
/** Zemlje u kojima se adresa prvo traži. */
const REGION = 'rs,ba,me,hr,mk';
/** Nominatim `importance` (0–1): gradovi su ~0.6+, ulice ~0.1–0.4, lokali ~0. */
const STRONG_MATCH = 0.5;
/** Koliko svetski rezultat mora biti bitniji od regionalnog da bi ga zamenio. */
const WORLD_MARGIN = 0.3;

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  importance?: number;
  address?: Record<string, string | undefined>;
}

function importance(r: NominatimResult | undefined): number {
  return r?.importance ?? 0;
}

@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly http = inject(HttpClient);

  /** Trenutna lokacija korisnika. Čuva se samo dok je tab otvoren. */
  readonly position = signal<UserLocation | null>(readStored());

  set(loc: UserLocation): void {
    this.position.set(loc);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
  }

  requestGps(): Promise<UserLocation> {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error(tr('loc.err.unsupported')));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async pos => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const label = await this.reverse(lat, lon).catch(() => tr('loc.current'));
          const loc: UserLocation = { lat, lon, label };
          this.set(loc);
          resolve(loc);
        },
        err =>
          reject(
            new Error(
              err.code === err.PERMISSION_DENIED
                ? tr('loc.err.denied')
                : tr('loc.err.unavailable')
            )
          ),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      );
    });
  }

  /**
   * Prvo traži u regionu, da npr. "Cara Dušana 10" vodi u Beograd, a ne u drugu zemlju.
   * Ako regionalni rezultat nije grad ili nešto podjednako bitno, traži i u celom svetu i uzima
   * svetski rezultat kad je znatno bitniji – "Berlin" je inače kafana "Berlin" u Podgorici.
   */
  async searchAddress(query: string): Promise<UserLocation> {
    let r: NominatimResult | undefined;
    try {
      r = (await this.search(query, REGION))[0];
      if (importance(r) < STRONG_MATCH) {
        const world = (await this.search(query))[0];
        if (world && (!r || importance(world) - importance(r) > WORLD_MARGIN)) r = world;
      }
    } catch {
      throw new Error(tr('loc.err.searchDown'));
    }
    if (!r) throw new Error(tr('loc.err.notFound'));
    const loc: UserLocation = { lat: Number(r.lat), lon: Number(r.lon), label: shortLabel(r) };
    this.set(loc);
    return loc;
  }

  private search(query: string, countryCodes?: string): Promise<NominatimResult[]> {
    let params = new HttpParams()
      .set('format', 'jsonv2')
      .set('q', query)
      .set('limit', '1')
      .set('addressdetails', '1')
      .set('accept-language', 'sr-Latn');
    if (countryCodes) params = params.set('countrycodes', countryCodes);
    return firstValueFrom(this.http.get<NominatimResult[]>(NOMINATIM + '/search', { params }));
  }

  private async reverse(lat: number, lon: number): Promise<string> {
    const params = new HttpParams()
      .set('format', 'jsonv2')
      .set('lat', String(lat))
      .set('lon', String(lon))
      .set('accept-language', 'sr-Latn');
    const r = await firstValueFrom(this.http.get<NominatimResult>(NOMINATIM + '/reverse', { params }));
    return shortLabel(r);
  }
}

function shortLabel(r: NominatimResult): string {
  const a = r.address ?? {};
  const street = [a['road'], a['house_number']].filter(Boolean).join(' ');
  const place = a['suburb'] || a['city_district'] || a['city'] || a['town'] || a['village'];
  const label = [street, place].filter(Boolean).join(', ');
  return label || r.display_name.split(',').slice(0, 2).join(',');
}

function readStored(): UserLocation | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UserLocation) : null;
  } catch {
    return null;
  }
}
