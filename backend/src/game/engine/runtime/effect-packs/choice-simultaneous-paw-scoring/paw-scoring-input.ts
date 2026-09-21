type CardInput = { cardId: string; targetPlayerId?: number };

export function includesInput(inputs: readonly CardInput[], input: CardInput) {
  return inputs.some(
    (candidate) =>
      candidate.cardId === input.cardId &&
      candidate.targetPlayerId === input.targetPlayerId,
  );
}
