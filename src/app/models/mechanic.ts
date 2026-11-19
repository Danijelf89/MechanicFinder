import { TKey, tr } from '../i18n/i18n';

export type ServiceType ='mehanicar' | 'limar' | 'vulkanizer';
export type Filter = ServiceType | 'svi';

export interface ServiceTypeInfo {
  key: ServiceType;
  label: string;
  letter: string;
  hint: string;
  color: string;
  tint: string;
}

/** label/hint su getteri: čitaju trenutni jezik, pa se template-i sami osveže pri promeni jezika. */
function typeInfo(key: ServiceType, color: string, tint: string): ServiceTypeInfo {
  return {
    key,
    color,
    tint,
    get letter() {
      return tr(('type.' + key + '.letter') as TKey);
    },
    get label() {
      return tr(('type.' + key) as TKey);
    },
    get hint() {
      return tr(('type.' + key + '.hint') as TKey);
    }
  };
}

export const SERVICE_TYPES: Record<ServiceType, ServiceTypeInfo> = {
  mehanicar: typeInfo('mehanicar', '#2e5bd8', '#e3eafc'),
  limar: typeInfo('limar', '#8a3fd1', '#f0e6fb'),
  vulkanizer: typeInfo('vulkanizer', '#138a5e', '#dcf3ea')
};

export const SERVICE_TYPE_LIST: ServiceTypeInfo[] = Object.values(SERVICE_TYPES);

export interface Mechanic {
  id: string;
  name: string;
  type: ServiceType;
  lat: number;
  lon: number;
  distanceKm: number;
  address?: string;
  phone?: string;
  hours?: string;
  website?: string;
}

export interface UserLocation {
  lat: number;
  lon: number;
  label: string;
}
