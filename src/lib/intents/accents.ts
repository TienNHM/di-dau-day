import type { Accent } from './registry';
import type { Category } from '@/lib/places/types';

/**
 * Accent per category.
 *
 * A place page is reached from a share link as often as from the wizard, and a
 * shared link carries no intent. Deriving the colour from the place's own category
 * means the page looks deliberate either way, and looks the same every time — the
 * OG image and the live page must match, or the tap feels like a bait and switch.
 */
export const CATEGORY_ACCENTS: Record<Category, Accent> = {
  food: { from: '#ef4d23', to: '#f5a524', on: '#ffffff' },
  cafe: { from: '#8b5a2b', to: '#c78a3e', on: '#ffffff' },
  entertainment: { from: '#0f9d8f', to: '#0ea5b7', on: '#ffffff' },
  outdoor: { from: '#0f9d8f', to: '#7cb342', on: '#ffffff' },
  dating: { from: '#8b3a86', to: '#ef4d23', on: '#ffffff' },
  family: { from: '#e0761c', to: '#f5b524', on: '#ffffff' },
  shopping: { from: '#5a4ae3', to: '#8b3a86', on: '#ffffff' },
  activity: { from: '#1d6fd0', to: '#0ea5b7', on: '#ffffff' },
};

export function accentFor(category: Category): Accent {
  return CATEGORY_ACCENTS[category];
}
