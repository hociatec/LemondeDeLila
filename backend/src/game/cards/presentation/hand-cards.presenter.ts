export type PresentedHandCard = {
  id: string;
  label: string;
  description?: string;
  family?: string;
  color?: string;
  disabled?: boolean;
  actionIndex?: number;
};

type PresentedActionLike = {
  type: string;
  payload?: Record<string, unknown>;
};

type HandActionBinding = {
  actionTypes?: readonly string[];
  disableUnbound?: boolean;
};

function scalarText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function targetsCard(action: PresentedActionLike, cardId: string): boolean {
  const payload = action.payload ?? {};
  return ['cardId', 'memberId', 'card', 'id', 'value'].some(
    (key) => scalarText(payload[key]) === cardId,
  );
}

export function bindHandCardActions(
  cards: PresentedHandCard[],
  actions: PresentedActionLike[],
  binding: HandActionBinding = {},
): PresentedHandCard[] {
  const allowedTypes = binding.actionTypes?.length
    ? new Set(binding.actionTypes)
    : null;
  const usedActions = new Set<number>();

  return cards.map((card) => {
    const actionIndex = actions.findIndex(
      (action, index) =>
        !usedActions.has(index) &&
        (!allowedTypes || allowedTypes.has(action.type)) &&
        targetsCard(action, card.id),
    );
    if (actionIndex >= 0) {
      usedActions.add(actionIndex);
      return { ...card, actionIndex };
    }
    return binding.disableUnbound ? { ...card, disabled: true } : card;
  });
}
