type StateWithDice = {
  system?: { turn?: { number?: number } };
  kits?: { dice?: unknown };
  actions?: unknown;
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
  const current = asRecord(state.kits?.dice);
  const actions = Array.isArray(state.actions) ? state.actions : [];
  const rollActionIndex = actions.findIndex((action) =>
    isRollAction(asRecord(action).type),
  );
  const total = positiveInteger(current.total);
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
  const turnIndex = state.system?.turn?.number ?? 0;

  return {
    ...state,
    kits: {
      ...(state.kits ?? {}),
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

function isRollAction(value: unknown): boolean {
  return value === 'roll';
}
