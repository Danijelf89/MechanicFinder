import { Component, inject } from '@angular/core';
import { I18n } from '../../i18n/i18n';

/** Logo: ikonica ključa + naziv aplikacije na izabranom jeziku. Stilovi su globalni (.logo u styles.css). */
@Component({
  selector: 'app-logo',
  template: `
    <span class="logo">
      <span class="logo__mark" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path fill="currentColor" d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1 0-1.4z"/></svg>
      </span>
      {{ i.t('app.title') }}
    </span>
  `,
  styles: [':host { display: inline-flex; } .logo__mark svg { width: 58%; height: 58%; }']
})
export class LogoComponent {
  readonly i = inject(I18n);
}
