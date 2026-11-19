import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { applyDocument } from './app/i18n/i18n';

// <html lang> i naslov taba na sačuvanom jeziku, pre prvog prikaza.
applyDocument();

bootstrapApplication(AppComponent, appConfig).catch(err => console.error(err));
