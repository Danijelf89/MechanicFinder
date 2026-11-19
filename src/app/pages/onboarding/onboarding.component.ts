import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SERVICE_TYPE_LIST } from '../../models/mechanic';
import { ONBOARDING_KEY } from '../../app.routes';
import { I18n } from '../../i18n/i18n';
import { LogoComponent } from '../../components/logo/logo.component';
import { LangSwitchComponent } from '../../components/lang-switch/lang-switch.component';

@Component({
  selector: 'app-onboarding',
  imports: [LogoComponent, LangSwitchComponent],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.css'
})
export class OnboardingComponent {
  private readonly router = inject(Router);
  readonly i = inject(I18n);
  readonly types = SERVICE_TYPE_LIST;

  start(): void {
    localStorage.setItem(ONBOARDING_KEY, '1');
    this.router.navigate(['/lokacija']);
  }
}
