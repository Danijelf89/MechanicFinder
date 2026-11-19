import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { LocationService } from './services/location.service';

export const ONBOARDING_KEY = 'mb.onboarding';

const onboardingNotSeen = () =>
  localStorage.getItem(ONBOARDING_KEY) ? inject(Router).createUrlTree(['/lokacija']) : true;

const hasLocation = () =>
  inject(LocationService).position() ? true : inject(Router).createUrlTree(['/lokacija']);

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
