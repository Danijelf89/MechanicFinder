import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MapComponent } from '../../components/map/map.component';
import { LocationService } from '../../services/location.service';
import { MechanicService } from '../../services/mechanic.service';
import { I18n } from '../../i18n/i18n';
import { Mechanic, SERVICE_TYPES } from '../../models/mechanic';
import { directionsUrl, etaMinutes, formatKm, telUrl, translateHours, websiteHost, websiteUrl } from '../../utils/format';

@Component({
  selector: 'app-profile',
  imports: [RouterLink, MapComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent {
  /** Iz rute majstor/:id (withComponentInputBinding). */
  readonly id = input.required<string>();

  readonly location = inject(LocationService);
  readonly svc = inject(MechanicService);
  readonly i = inject(I18n);
  readonly T = SERVICE_TYPES;

  readonly mechanic = computed<Mechanic | null>(() => this.svc.mechanics().find(m => m.id === this.id()) ?? null);
  readonly mechList = computed<Mechanic[]>(() => {
    const m = this.mechanic();
    return m ? [m] : [];
  });

  readonly km = formatKm;
  readonly eta = etaMinutes;
  readonly dir = directionsUrl;
  readonly tel = telUrl;
  readonly hours = translateHours;
  readonly siteUrl = websiteUrl;
  readonly siteHost = websiteHost;

  constructor() {
    // Ako je stranica otvorena direktno (refresh), učitaj listu da bismo našli majstora.
    const p = this.location.position();
    if (p && this.svc.status() === 'idle') this.svc.load(p, this.svc.radius());
  }
}
