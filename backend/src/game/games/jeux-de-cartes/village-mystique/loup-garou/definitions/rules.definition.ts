// Définition déclarative des rôles et de l’ordre d’intervention pour Loup Garou.
export const LOUP_GAROU_ROLES = [
  { id: 'seer', name: 'Voyante' },
  { id: 'cupid', name: 'Cupidon' },
  { id: 'werewolf', name: 'Loup' },
  { id: 'witch', name: 'Sorcière' },
  { id: 'villager', name: 'Villageois' },
];

export const LOUP_GAROU_PHASES: Array<{ id: string }> = [
  { id: 'seer' },
  { id: 'cupid' },
  { id: 'wolves' },
  { id: 'witch' },
  { id: 'resolve-night' },
  { id: 'announce' },
  { id: 'day-vote' },
  { id: 'resolve-day' },
  { id: 'check-victory' },
];
