import type { GameSingleActionDto } from '../../models/game-action.model';
import type { GameRng } from '../../models/game-execution-context.model';

export function randomLegalAction(
  actions: readonly GameSingleActionDto[],
  random: GameRng,
): GameSingleActionDto | null {
  const selected = random.pick(actions);
  return selected ? structuredClone(selected) : null;
}

export function preferAction(
  actions: readonly GameSingleActionDto[],
  ...types: readonly string[]
): GameSingleActionDto | null {
  for (const type of types) {
    const selected = actions.find((action) => action.type === type);
    if (selected) return structuredClone(selected);
  }
  return actions[0] ? structuredClone(actions[0]) : null;
}

export function weightedLegalAction(
  actions: readonly GameSingleActionDto[],
  weight: (action: GameSingleActionDto) => number,
  random: GameRng,
): GameSingleActionDto | null {
  const candidates = actions
    .map((action) => ({ action, weight: Math.max(0, weight(action)) }))
    .filter((candidate) => Number.isFinite(candidate.weight));
  const total = candidates.reduce(
    (sum, candidate) => sum + candidate.weight,
    0,
  );
  if (total <= 0) return randomLegalAction(actions, random);
  let cursor = random.next() * total;
  for (const candidate of candidates) {
    cursor -= candidate.weight;
    if (cursor <= 0) return structuredClone(candidate.action);
  }
  const fallback = candidates.at(-1)?.action ?? actions[0];
  return fallback ? structuredClone(fallback) : null;
}

export function maximizeScore(
  actions: readonly GameSingleActionDto[],
  score: (action: GameSingleActionDto) => number,
  random?: GameRng,
): GameSingleActionDto | null {
  let maximum = Number.NEGATIVE_INFINITY;
  let candidates: GameSingleActionDto[] = [];
  for (const action of actions) {
    const value = score(action);
    if (!Number.isFinite(value)) continue;
    if (value > maximum) {
      maximum = value;
      candidates = [action];
    } else if (value === maximum) {
      candidates.push(action);
    }
  }
  if (candidates.length === 0) return null;
  const selected = random?.pick(candidates) ?? candidates[0];
  return selected ? structuredClone(selected) : null;
}
