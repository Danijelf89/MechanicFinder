import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LocationService } from '../../services/location.service';
import { I18n, tr } from '../../i18n/i18n';
import { LangSwitchComponent } from '../../components/lang-switch/lang-switch.component';

@Component({
  selector: 'app-location',
  imports: [RouterLink, LangSwitchComponent],
  templateUrl: './location.component.html',
  styleUrl: './location.component.css'
})
export class LocationComponent {
  private readonly router = inject(Router);
  readonly location = inject(LocationService);
  readonly i = inject(I18n);

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly manual = signal(false);
  readonly query = signal('');

  async useGps(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.location.requestGps();
      this.router.navigate(['/mapa']);
    } catch (e) {
      this.error.set(message(e));
      this.manual.set(true);
    } finally {
      this.busy.set(false);
    }
  }

  async search(ev: Event): Promise<void> {
    ev.preventDefault();
    const q = this.query().trim();
    if (q.length < 3) {
      this.error.set(tr('loc.err.short'));
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.location.searchAddress(q);
      this.router.navigate(['/mapa']);
    } catch (e) {
      this.error.set(message(e));
    } finally {
      this.busy.set(false);
    }
  }
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : tr('loc.err.generic');
}
