import type { GameSingleActionDto } from '../engine/dto/game-action.dto';

export function normalizeActionType(
  action: Pick<GameSingleActionDto, 'type'> | null | undefined,
): string {
  return String(action?.type ?? '').trim();
}

export function normalizeLowerActionType(
  action: Pick<GameSingleActionDto, 'type'> | null | undefined,
): string {
  return normalizeActionType(action).toLowerCase();
}

export function applyActionsSequentially<State, Action>(
  state: State,
  actions: Action[] | null | undefined,
  applier: (state: State, action: Action) => State,
): State {
  let next = state;
  for (const action of actions ?? []) {
    next = applier(next, action);
  }
  return next;
}

export function dispatchByActionType<State>(
  type: string,
  handlers: Record<string, () => State>,
  fallback: () => State,
): State {
  const handler = handlers[type];
  return handler ? handler() : fallback();
}
