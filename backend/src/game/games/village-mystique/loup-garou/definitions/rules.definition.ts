import { LOUP_GAROU_GAME } from './game.definition';

// Compat exports (used by generic clients).
export const LOUP_GAROU_ROLES = LOUP_GAROU_GAME.roles.map((r) => ({
  id: r.id,
  name: r.name,
}));

export const LOUP_GAROU_PHASES: Array<{ id: string }> =
  LOUP_GAROU_GAME.phaseOrder.map((p) => ({ id: p.id }));
