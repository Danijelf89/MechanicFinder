import { AfterViewInit, Component, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import { LocationService } from '../../services/location.service';
import { CITIES, PlaceDetails, PlaceHit, PlaceLookupService, Point } from '../../services/place-lookup.service';
import { directionsUrl, etaMinutes, formatKm, haversineKm, telUrl, translateHours, websiteHost, websiteUrl } from '../../utils/format';
import { openStatus } from '../../utils/hours';
import { I18n, tr } from '../../i18n/i18n';

/** Vrednost u padajućem meniju kad tražimo oko trenutne lokacije korisnika. */
const NEAR_ME = '';

type Phase = 'form' | 'searching' | 'results' | 'loading-details' | 'details' | 'empty' | 'error';

/** Modal "Proveri majstora ručno": ime + grad -> pogoci -> detalji sa interneta. */
@Component({
  selector: 'app-manual-check',
  templateUrl: './manual-check.component.html',
  styleUrl: './manual-check.component.css'
})
export class ManualCheckComponent implements AfterViewInit {
  private readonly lookup = inject(PlaceLookupService);
  readonly location = inject(LocationService);
  readonly i = inject(I18n);
  readonly closed = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly cities = CITIES;
  readonly NEAR_ME = NEAR_ME;

  readonly name = signal('');
  readonly city = signal<string>(this.location.position() ? NEAR_ME : CITIES[0].name);
  readonly phase = signal<Phase>('form');
  readonly hits = signal<PlaceHit[]>([]);
  readonly details = signal<PlaceDetails | null>(null);

  readonly km = formatKm;
  readonly eta = etaMinutes;
  readonly hoursLines = translateHours;
  readonly siteUrl = websiteUrl;
  readonly siteHost = websiteHost;
  readonly tel = telUrl;

  ngAfterViewInit(): void {
    this.dialog().nativeElement.showModal();
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  /** Okida se i na Esc i na close(). */
  onDialogClose(): void {
    this.closed.emit();
  }

  /** Klik na pozadinu (van sadržaja) zatvara modal. */
  onBackdrop(e: MouseEvent): void {
    if (e.target === this.dialog().nativeElement) this.close();
  }

  cityLabel(): string {
    return this.city() === NEAR_ME ? (this.location.position()?.label ?? tr('mc.yourLoc')) : this.city();
  }

  private center(): Point | null {
    if (this.city() === NEAR_ME) return this.location.position() ?? null;
    return CITIES.find(c => c.name === this.city()) ?? null;
  }

  async search(e?: Event): Promise<void> {
    e?.preventDefault();
    const q = this.name().trim();
    const center = this.center();
    if (!q || !center) return;
    this.phase.set('searching');
    this.details.set(null);
    try {
      const hits = await this.lookup.search(q, center);
      this.hits.set(hits);
      if (!hits.length) this.phase.set('empty');
      else if (hits.length === 1) await this.open(hits[0]);
      else this.phase.set('results');
    } catch {
      this.phase.set('error');
    }
  }

  async open(hit: PlaceHit): Promise<void> {
    this.phase.set('loading-details');
    try {
      this.details.set(await this.lookup.details(hit));
    } catch {
      // Detalji nisu stigli – prikaži bar ono što imamo iz pretrage.
      this.details.set(hit);
    }
    this.phase.set('details');
  }

  back(): void {
    this.phase.set(this.hits().length > 1 ? 'results' : 'form');
  }

  distanceKm(p: Point): number | null {
    const me = this.location.position();
    return me ? haversineKm(me.lat, me.lon, p.lat, p.lon) : null;
  }

  status(d: PlaceDetails) {
    return openStatus(d.hours, new Date());
  }

  readonly dir = directionsUrl;

  /** Spoljna pretraga kao dopuna – Google često ima radnje kojih nema u OpenStreetMap-u. */
  googleMapsUrl(): string {
    const city = this.city() === NEAR_ME ? '' : ' ' + this.city();
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(this.name().trim() + city);
  }

  googleSearchUrl(d: PlaceDetails): string {
    return 'https://www.google.com/search?q=' + encodeURIComponent(d.name + ' ' + d.address);
  }
}
