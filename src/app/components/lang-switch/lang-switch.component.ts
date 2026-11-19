import { Component, inject, input } from '@angular/core';
import { I18n } from '../../i18n/i18n';

/** Prekidač jezika SR | EN. `dark` za tamnu pozadinu (onboarding). */
@Component({
  selector: 'app-lang-switch',
  template: `
    <div class="lang" role="group" [attr.aria-label]="i.t('lang.label')">
      @for (l of i.langs; track l) {
        <button type="button" [class.on]="i.lang() === l" [attr.aria-pressed]="i.lang() === l" (click)="i.set(l)">
          {{ l.toUpperCase() }}
        </button>
      }
    </div>
  `,
  styles: [`
    :host { display: inline-flex; }
    .lang {
      display: inline-flex;
      padding: 3px;
      border-radius: 11px;
      background: #ebe8e1;
    }
    button {
      min-width: 38px;
      height: 30px;
      padding: 0 8px;
      border: 0;
      border-radius: 8px;
      background: none;
      font: 700 12.5px/1 var(--font);
      letter-spacing: .04em;
      color: var(--ink-2);
      cursor: pointer;
    }
    button.on { background: #fff; color: var(--ink); box-shadow: 0 1px 4px rgba(0, 0, 0, .12); }
    button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
    :host(.dark) .lang { background: #22252a; }
    :host(.dark) button { color: #a5a9b0; }
    :host(.dark) button.on { background: #3a3e45; color: #fff; box-shadow: none; }
    :host(.float) .lang { background: #fff; box-shadow: 0 4px 14px rgba(0, 0, 0, .14); }
    :host(.float) button.on { background: var(--ink); color: #fff; box-shadow: none; }
  `],
  host: { '[class.dark]': 'dark()', '[class.float]': 'float()' }
})
export class LangSwitchComponent {
  readonly i = inject(I18n);
  readonly dark = input(false);
  /** Bela "lebdeća" varijanta, za preko mape na telefonu. */
  readonly float = input(false);
}
