import type { UserShortcut } from '../models/user-shortcuts.model';

export const SHORTCUT_FUNCTIONS = new Set([
  'main_menu',
  'catalog',
  'chat',
  'messaging',
  'inbox',
  'social',
  'leaderboard',
  'vault',
  'options',
  'contact',
  'admin',
  'shortcuts',
  'return_table',
]);
const RESERVED = new Set([
  'CTRL+SHIFT+C',
  'CTRL+SHIFT+V',
  'CTRL+SHIFT+X',
  'CTRL+SHIFT+Z',
]);
export function validateShortcuts(value: unknown): UserShortcut[] {
  if (!Array.isArray(value) || value.length > 50)
    throw new Error('Maximum 50 raccourcis.');
  const chords = new Set<string>();
  return value.map((item: unknown) => {
    if (!item || typeof item !== 'object')
      throw new Error('Raccourci invalide.');
    const row = item as Record<string, unknown>;
    if (
      typeof row.target !== 'string' ||
      (!SHORTCUT_FUNCTIONS.has(row.target) &&
        !/^game:[a-z0-9][a-z0-9_-]{0,95}$/.test(row.target))
    )
      throw new Error('Destination inconnue.');
    if (
      typeof row.label !== 'string' ||
      !row.label.trim() ||
      row.label.length > 120
    )
      throw new Error('Nom invalide (120 caractères maximum).');
    if (
      typeof row.chord !== 'string' ||
      !/^(CTRL|ALT)\+SHIFT\+([A-Z0-9]|F[1-9]|F1[0-2])$/.test(row.chord) ||
      RESERVED.has(row.chord)
    )
      throw new Error(
        'Combinaison réservée ou invalide. Utilisez Ctrl+Maj ou Alt+Maj avec une lettre, un chiffre ou F1 à F12.',
      );
    if (typeof row.enabled !== 'boolean')
      throw new Error('État du raccourci invalide.');
    if (chords.has(row.chord))
      throw new Error('Cette combinaison est déjà attribuée.');
    chords.add(row.chord);
    return {
      target: row.target,
      label: row.label.trim(),
      chord: row.chord,
      enabled: row.enabled,
    };
  });
}
