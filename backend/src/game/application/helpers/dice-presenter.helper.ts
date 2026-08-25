import { isRollActionType } from './action-service.helper';

type StateWithDice = {
  lastRoll?: unknown;
  turnIndex?: unknown;
  actions?: unknown;
  extras?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function positiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
}

export function withDicePresentation<T extends StateWithDice>(state: T): T {
  const extras = asRecord(state.extras);
  const current = asRecord(extras.dice);
  const actions = Array.isArray(state.actions) ? state.actions : [];
  const rollActionIndex = actions.findIndex((action) =>
    isRollActionType(asRecord(action).type),
  );
  const total = positiveInteger(current.total ?? state.lastRoll);
  const existingDice = Array.isArray(current.dice) ? current.dice : [];

  if (rollActionIndex < 0 && total == null && existingDice.length === 0) {
    return state;
  }

  const dice =
    existingDice.length > 0
      ? existingDice
      : rollActionIndex >= 0
        ? [
            {
              id: 'main',
              label: 'Dé',
              sides: positiveInteger(current.sides) ?? 6,
              actionIndex: rollActionIndex,
            },
          ]
        : [];
  const turnIndex = Number.isFinite(Number(state.turnIndex))
    ? Math.trunc(Number(state.turnIndex))
    : 0;

  return {
    ...state,
    extras: {
      ...extras,
      dice: {
        ...current,
        label:
          typeof current.label === 'string' && current.label.trim()
            ? current.label
            : 'Dés',
        dice,
        ...(total != null ? { total } : {}),
        ...(rollActionIndex >= 0 ? { rollActionIndex } : {}),
        rollKey:
          typeof current.rollKey === 'string' && current.rollKey.trim()
            ? current.rollKey
            : total != null
              ? `${turnIndex}:${total}`
              : '',
      },
    },
  };
}
