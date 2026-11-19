import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MapComponent } from '../../components/map/map.component';
import { ManualCheckComponent } from '../../components/manual-check/manual-check.component';
import { LogoComponent } from '../../components/logo/logo.component';
import { LangSwitchComponent } from '../../components/lang-switch/lang-switch.component';
import { I18n, tr } from '../../i18n/i18n';
import { LocationService } from '../../services/location.service';
import { MechanicService, SortMode } from '../../services/mechanic.service';
import { OpenStatus, openStatus } from '../../utils/hours';
import { Filter, Mechanic, SERVICE_TYPES, SERVICE_TYPE_LIST } from '../../models/mechanic';
import { directionsUrl, etaMinutes, formatKm, normalizeSearch, pluralMajstor, telUrl, translateHours } from '../../utils/format';

const MOBILE_QUERY = '(max-width: 899px)';

@Component({
  selector: 'app-finder',
  imports: [RouterLink, MapComponent, ManualCheckComponent, LogoComponent, LangSwitchComponent],
  templateUrl: './finder.component.html',
  styleUrl: './finder.component.css'
})
export class FinderComponent {
  private readonly router = inject(Router);
  readonly location = inject(LocationService);
  readonly svc = inject(MechanicService);
  readonly i = inject(I18n);

  readonly T = SERVICE_TYPES;
  readonly types = SERVICE_TYPE_LIST;
  readonly radii = [2, 5, 10, 20];
  readonly skeleton = [1, 2, 3, 4, 5];

  readonly selectedId = signal<string | null>(null);
  readonly manualOpen = signal(false);
  readonly isMobile = signal(window.matchMedia(MOBILE_QUERY).matches);
  readonly sheetPx = Math.round(window.innerHeight * 0.46);

  /** Trenutno vreme, osvežava se svakog minuta da bi status "otvoreno" bio tačan. */
  readonly now = signal(new Date());

  /** Status otvorenosti za svakog majstora: open / soon (< 1h) / closed / null (nepoznato). */
  readonly openState = computed(() => {
    const now = this.now();
    const map = new Map<string, OpenStatus>();
    for (const m of this.svc.mechanics()) map.set(m.id, openStatus(m.hours, now));
    return map;
  });

  readonly visible = computed(() => {
    const f = this.svc.filter();
    const all = this.svc.mechanics();
    const words = normalizeSearch(this.svc.query()).split(' ').filter(Boolean);
    const list = all.filter(
      m =>
        (f === 'svi' || m.type === f) &&
        (!words.length || words.every(w => this.searchText(m).includes(w)))
    );
    if (this.svc.sort() === 'blizina') return list; // već sortirano po udaljenosti
    const open = this.openState();
    const order: Record<string, number> = { open: 0, soon: 1, null: 2, closed: 3 };
    const rank = (m: Mechanic) => order[String(open.get(m.id) ?? null)];
    return [...list].sort((a, b) => rank(a) - rank(b) || a.distanceKm - b.distanceKm);
  });

  readonly counts = computed(() => {
    const c: Record<Filter, number> = { svi: 0, mehanicar: 0, limar: 0, vulkanizer: 0 };
    for (const m of this.svc.mechanics()) {
      c[m.type]++;
      c.svi++;
    }
    return c;
  });

  readonly selected = computed(() => this.visible().find(m => m.id === this.selectedId()) ?? null);

  readonly countLabel = computed(() => {
    const n = this.visible().length;
    return tr('fd.count', { n, word: pluralMajstor(n), r: this.svc.radius() });
  });

  readonly nextRadius = computed(() => this.radii.find(r => r > this.svc.radius()) ?? null);

  readonly km = formatKm;
  readonly eta = etaMinutes;
  readonly dir = directionsUrl;
  readonly tel = telUrl;
  readonly hours = translateHours;

  constructor() {
    effect(() => {
      const p = this.location.position();
      const r = this.svc.radius();
      if (p) untracked(() => this.svc.load(p, r));
    });

    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = (e: MediaQueryListEvent) => this.isMobile.set(e.matches);
    mq.addEventListener('change', onChange);
    const tick = setInterval(() => this.now.set(new Date()), 60_000);
    inject(DestroyRef).onDestroy(() => {
      mq.removeEventListener('change', onChange);
      clearInterval(tick);
    });
  }

  /**
   * Normalizovan tekst po kome se pretražuje (naziv, adresa, vrsta). Ne keširamo ga jer
   * vrsta i naziv radnji bez imena zavise od jezika; za par stotina majstora je dovoljno brzo.
   */
  private searchText(m: Mechanic): string {
    return normalizeSearch([m.name, m.address, SERVICE_TYPES[m.type].label].filter(Boolean).join(' '));
  }

  setQuery(q: string): void {
    this.svc.query.set(q);
  }

  setSort(s: SortMode): void {
    this.svc.sort.set(s);
  }

  setFilter(f: Filter): void {
    this.svc.filter.set(f);
  }

  setRadius(value: string | number): void {
    this.svc.radius.set(Number(value));
    this.selectedId.set(null);
  }

  pick(m: Mechanic): void {
    if (this.isMobile()) this.router.navigate(['/majstor', m.id]);
    else this.selectedId.set(m.id);
  }

  onPin(id: string): void {
    const m = this.visible().find(x => x.id === id);
    if (m) this.pick(m);
  }

  retry(): void {
    const p = this.location.position();
    if (p) this.svc.load(p, this.svc.radius(), true);
  }
}
