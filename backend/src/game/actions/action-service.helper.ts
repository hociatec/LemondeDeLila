import type { GameSingleActionDto } from '../engine/dto/game-action.dto';

const DEFAULT_ACTION_ALIASES: Record<string, string> = {
  ROLL_DICE: 'roll',
  roll_dice: 'roll',
};

export type ActionPipelineHandlers<
  State,
  Action,
  ValidatedPayload = undefined,
  TransitionResult = State,
> = {
  guard?: (state: State, action: Action) => boolean;
  validate?: (state: State, action: Action) => ValidatedPayload;
  transition: (
    state: State,
    action: Action,
    payload: ValidatedPayload,
  ) => TransitionResult;
  effects?: (
    state: State,
    action: Action,
    payload: ValidatedPayload,
    transitionResult: TransitionResult,
  ) => State;
  logs?: (
    state: State,
    action: Action,
    payload: ValidatedPayload,
    transitionResult: TransitionResult,
    effectedState: State,
  ) => State;
};

export type ActionStateShape = {
  status?: unknown;
  pending?: unknown;
  metadata?: unknown;
};

export function harmonizeActionStateReturn<State extends ActionStateShape>(
  state: State,
): State {
  return {
    ...state,
    pending: state.pending ?? null,
    metadata: state.metadata ?? {},
  };
}

export function applyActionPipeline<
  State,
  Action,
  ValidatedPayload = undefined,
  TransitionResult = State,
>(
  state: State,
  action: Action,
  handlers: ActionPipelineHandlers<
    State,
    Action,
    ValidatedPayload,
    TransitionResult
  >,
): State {
  if (handlers.guard && !handlers.guard(state, action)) {
    return state;
  }

  const payload = handlers.validate
    ? handlers.validate(state, action)
    : (undefined as ValidatedPayload);
  const transitionResult = handlers.transition(state, action, payload);
  const effectedState = handlers.effects
    ? handlers.effects(state, action, payload, transitionResult)
    : (transitionResult as unknown as State);

  return handlers.logs
    ? handlers.logs(state, action, payload, transitionResult, effectedState)
    : effectedState;
}

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

export function isRollAlias(rawType: unknown, normalizedType?: unknown): boolean {
  const raw = String(rawType ?? '').trim();
  if (raw === 'ROLL_DICE' || raw === 'roll_dice') return true;
  const normalized = String(normalizedType ?? raw.toLowerCase()).trim();
  return normalized === 'roll_dice';
}

export function normalizeLegacyRollAliasToUpper(rawType: unknown): string {
  const raw = String(rawType ?? '').trim();
  return isRollAlias(raw) ? 'ROLL_DICE' : raw;
}

export function normalizeRollActionType(
  rawType: unknown,
  fallback = 'roll',
): string {
  const raw = String(rawType ?? '').trim();
  if (!raw) return fallback;
  return isRollAlias(raw) ? fallback : raw;
}

export function isRollActionType(
  rawType: unknown,
  normalizedType?: unknown,
): boolean {
  const normalized = normalizeRollActionType(
    rawType,
    String(normalizedType ?? '').trim() || 'roll',
  );
  return normalized === 'roll' || isRollAlias(rawType, normalizedType);
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
  const alias = DEFAULT_ACTION_ALIASES[type];
  const resolvedType = handlers[type]
    ? type
    : alias && handlers[alias]
      ? alias
      : type;
  const handler = handlers[resolvedType];
  return handler ? handler() : fallback();
}
