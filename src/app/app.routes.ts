import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { LocationService } from './services/location.service';
import { MechanicService } from './services/mechanic.service';
import { SERVICE_TYPES, ServiceType } from './models/mechanic';

export const ONBOARDING_KEY = 'mb.onboarding';

const onboardingNotSeen = () =>
  localStorage.getItem(ONBOARDING_KEY) ? inject(Router).createUrlTree(['/lokacija']) : true;

/**
 * Mapa traži lokaciju. Link sa SEO stranica (/mapa?lat=..&lon=..&mesto=Novi%20Sad&tip=vulkanizer)
 * sam postavlja lokaciju i filter, pa korisnik odmah vidi majstore u tom gradu.
 */
const hasLocation: CanActivateFn = route => {
  const location = inject(LocationService);
  const q = route.queryParamMap;
  const lat = Number(q.get('lat'));
  const lon = Number(q.get('lon'));
  if (q.has('lat') && q.has('lon') && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
    location.set({ lat, lon, label: (q.get('mesto') ?? '').slice(0, 80) || lat.toFixed(4) + ', ' + lon.toFixed(4) });
    const tip = q.get('tip');
    if (tip && tip in SERVICE_TYPES) inject(MechanicService).filter.set(tip as ServiceType);
  }
  return location.position() ? true : inject(Router).createUrlTree(['/lokacija']);
};

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [onboardingNotSeen],
    loadComponent: () => import('./pages/onboarding/onboarding.component').then(m => m.OnboardingComponent)
  },
  {
    path: 'lokacija',
    loadComponent: () => import('./pages/location/location.component').then(m => m.LocationComponent)
  },
  {
    path: 'mapa',
    canActivate: [hasLocation],
    loadComponent: () => import('./pages/finder/finder.component').then(m => m.FinderComponent)
  },
  {
    path: 'majstor/:id',
    canActivate: [hasLocation],
    loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent)
  },
  { path: '**', redirectTo: '' }
];
