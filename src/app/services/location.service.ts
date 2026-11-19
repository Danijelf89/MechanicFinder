import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { UserLocation } from '../models/mechanic';
import { tr } from '../i18n/i18n';

const STORAGE_KEY = 'mb.location';
const NOMINATIM = 'https://nominatim.openstreetmap.org';

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string | undefined>;
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

  async searchAddress(query: string): Promise<UserLocation> {
    const params = new HttpParams()
      .set('format', 'jsonv2')
      .set('q', query)
      .set('countrycodes', 'rs,ba,me,hr,mk')
      .set('limit', '1')
      .set('addressdetails', '1')
      .set('accept-language', 'sr-Latn');
    let res: NominatimResult[];
    try {
      res = await firstValueFrom(this.http.get<NominatimResult[]>(NOMINATIM + '/search', { params }));
    } catch {
      throw new Error(tr('loc.err.searchDown'));
    }
    if (!res.length) throw new Error(tr('loc.err.notFound'));
    const r = res[0];
    const loc: UserLocation = { lat: Number(r.lat), lon: Number(r.lon), label: shortLabel(r) };
    this.set(loc);
    return loc;
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
