import { AfterViewInit, Component, ElementRef, OnDestroy, effect, input, output, viewChild } from '@angular/core';
import * as L from 'leaflet';
import { Mechanic, SERVICE_TYPES, UserLocation } from '../../models/mechanic';
import { formatKm } from '../../utils/format';
import { GEOAPIFY_KEY } from '../../config';
import { OpenStatus } from '../../utils/hours';

/** Geoapify stil pločica: klasičan OSM izgled – jedini sa nazivima skoro svih ulica i objekata. */
const MAP_STYLE = 'osm-carto';

const HTML_ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => HTML_ESC[c]);
}

/** Leaflet mapa sa pinovima majstora i tačkom korisnika. */
@Component({
  selector: 'app-map',
  template: '<div #host class="host"></div>',
  styles: [':host { display: block; position: relative; } .host { position: absolute; inset: 0; }']
})
export class MapComponent implements AfterViewInit, OnDestroy {
  readonly center = input.required<UserLocation>();
  readonly mechanics = input<Mechanic[]>([]);
  readonly selectedId = input<string | null>(null);
  readonly interactive = input(true);
  /** Prostor koji pokrivaju elementi iznad mape (npr. mobilni bottom sheet), u px. */
  readonly topPadding = input(0);
  readonly bottomPadding = input(0);
  /** Ako je zadat, svaki pin dobija kružić u boji statusa radnog vremena. */
  readonly status = input<Map<string, OpenStatus> | null>(null);
  readonly select = output<string>();

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private map?: L.Map;
  private readonly layer = L.layerGroup();
  private lastList?: Mechanic[];
  private lastCenter?: UserLocation;

  constructor() {
    effect(() => {
      this.status(); // pinovi se ponovo iscrtavaju kad se promeni status otvorenosti
      this.render(this.center(), this.mechanics(), this.selectedId(), this.topPadding(), this.bottomPadding());
    });
  }

  ngAfterViewInit(): void {
    const c = this.center();
    const on = this.interactive();
    this.map = L.map(this.host().nativeElement, {
      zoomControl: false,
      dragging: on,
      scrollWheelZoom: on,
      doubleClickZoom: on,
      touchZoom: on,
      boxZoom: on,
      keyboard: on
    }).setView([c.lat, c.lon], 14);

    const retina = L.Browser.retina ? '@2x' : '';
    L.tileLayer('https://maps.geoapify.com/v1/tile/' + MAP_STYLE + '/{z}/{x}/{y}' + retina + '.png?apiKey=' + GEOAPIFY_KEY, {
      maxZoom: 20,
      attribution:
        'Powered by <a href="https://www.geoapify.com/">Geoapify</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(this.map);
    if (on) L.control.zoom({ position: 'topright' }).addTo(this.map);
    this.layer.addTo(this.map);

    this.render(c, this.mechanics(), this.selectedId(), this.topPadding(), this.bottomPadding());
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private render(c: UserLocation, list: Mechanic[], sel: string | null, top: number, bottom: number): void {
    const map = this.map;
    if (!map) return;

    this.layer.clearLayers();
    L.marker([c.lat, c.lon], {
      icon: L.divIcon({ className: 'mb-icon', html: '<div class="me-dot"></div>', iconSize: [0, 0] }),
      interactive: false,
      zIndexOffset: -1000
    }).addTo(this.layer);

    const status = this.status();
    for (const m of list) {
      const t = SERVICE_TYPES[m.type];
      const isSel = m.id === sel;
      const st = status?.get(m.id);
      const stDot = st ? '<span class="pin__st pin__st--' + st + '"></span>' : '';
      // Kompaktan pin (samo slovo) da se mapa ne zatrpa; izabrani se proširi u naziv + udaljenost.
      const html = isSel
        ? '<div class="pin pin--sel">' +
          '<span class="pin__dot" style="background:' + t.color + '">' + t.letter + '</span>' +
          '<span class="pin__label">' + escapeHtml(m.name) + '</span>' +
          '<span class="pin__km">' + formatKm(m.distanceKm) + '</span>' +
          stDot +
          '</div>'
        : '<div class="pin" style="--c:' + t.color + '"><span class="pin__dot" style="background:' + t.color + '">' + t.letter + '</span>' + stDot + '</div>';
      const marker = L.marker([m.lat, m.lon], {
        icon: L.divIcon({ className: 'mb-icon', html, iconSize: [0, 0] }),
        zIndexOffset: isSel ? 1000 : 0,
        keyboard: false,
        title: m.name
      });
      marker.on('click', () => this.select.emit(m.id));
      marker.addTo(this.layer);
    }

    const changed = list !== this.lastList || c !== this.lastCenter;
    if (changed) {
      this.lastList = list;
      this.lastCenter = c;
      const pts: L.LatLngTuple[] = [[c.lat, c.lon], ...list.slice(0, 8).map(m => [m.lat, m.lon] as L.LatLngTuple)];
      if (pts.length > 1) {
        map.fitBounds(L.latLngBounds(pts), {
          paddingTopLeft: [40, top + 50],
          paddingBottomRight: [40, bottom + 30],
          maxZoom: 16
        });
      } else {
        map.setView([c.lat, c.lon], 15);
      }
    } else if (sel) {
      // Izabrani pin mora biti u vidljivom delu mape (između gornjih kontrola i kartice na dnu).
      const m = list.find(x => x.id === sel);
      if (m) {
        const p = map.latLngToContainerPoint([m.lat, m.lon]);
        const size = map.getSize();
        // Izabrani pin ima oznaku sa nazivom (do ~260px širine, centriranu na pinu) – i ona mora stati na ekran.
        const halfLabel = Math.min(140, size.x / 2 - 10);
        if (p.x < halfLabel || p.x > size.x - halfLabel || p.y < top + 40 || p.y > size.y - bottom - 10) {
          const targetY = top + (size.y - top - bottom) / 2;
          map.panBy([p.x - size.x / 2, p.y - targetY]);
        }
      }
    }
  }
}
