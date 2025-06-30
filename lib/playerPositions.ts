export function getPositionColor(position: string) {
  const safe = position?.toLowerCase() || '';
  switch (safe) {
    case 'goalkeeper':
    case 'gk':
    case 'keeper':
      return '#DC2626';
    case 'defender':
    case 'def':
    case 'verdediger':
    case 'sweeper':
    case 'lastline':
    case 'leftback':
    case 'rightback':
      return '#1E40AF';
    case 'midfielder':
    case 'mid':
    case 'middenvelder':
    case 'leftmidfield':
    case 'rightmidfield':
    case 'centermidfield':
      return '#7C3AED';
    case 'forward':
    case 'fwd':
    case 'aanvaller':
    case 'striker':
    case 'leftforward':
    case 'rightforward':
      return '#EA580C';
    default:
      return '#6B7280';
  }
}

export function getPositionDisplayName(position: string) {
  const safe = position?.toLowerCase() || '';
  switch (safe) {
    case 'striker':
      return 'Aanvaller';
    case 'sweeper':
      return 'Libero';
    case 'lastline':
      return 'Laatste Lijn';
    case 'leftback':
      return 'Linksback';
    case 'rightback':
      return 'Rechtsback';
    case 'leftmidfield':
      return 'Linksmidden';
    case 'rightmidfield':
      return 'Rechtsmidden';
    case 'centermidfield':
      return 'Middenmidden';
    case 'leftforward':
      return 'Linksvoorwaarts';
    case 'rightforward':
      return 'Rechtsvoorwaarts';
    case 'goalkeeper':
    case 'gk':
    case 'keeper':
      return 'Keeper';
    case 'defender':
    case 'def':
    case 'verdediger':
      return 'Verdediger';
    case 'midfielder':
    case 'mid':
    case 'middenvelder':
      return 'Middenvelder';
    case 'forward':
    case 'fwd':
    case 'aanvaller':
      return 'Aanvaller';
    default:
      return position || 'Onbekend';
  }
}

import { FormationPosition } from '@/types/database';

export function getDutchPositionName(pos: FormationPosition): string {
  if (pos.label_translations && pos.label_translations.nl) {
    return pos.label_translations.nl;
  }

  return pos.dutch_name || pos.name || 'Onbekend';
}
