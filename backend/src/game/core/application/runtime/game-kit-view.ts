import { projectCardsKitState } from './cards-kit';
import type { EngineKitsState } from './game-definition';

export function projectGameKits(
  kits: EngineKitsState,
  viewerPlayerId: number | null,
  turnNumber: number,
): Record<string, unknown> {
  const extras: Record<string, unknown> = {};
  if (Object.keys(kits.cards.decks).length > 0) {
    extras.cards = projectCardsKitState(kits.cards, viewerPlayerId);
  }
  const dice = kits.dice;
  const latest = Object.entries(dice.rolls).at(-1);
  const setId = latest?.[0] ?? Object.keys(dice.sets)[0];
  const definition = setId ? dice.sets[setId] : null;
  if (!setId || !definition) return extras;
  const roll = latest?.[0] === setId ? latest[1] : null;
  extras.dice = {
    id: setId,
    label: definition.count > 1 ? 'Dés' : 'Dé',
    sides: definition.sides,
    dice: Array.from({ length: definition.count }, (_, index) => ({
      id: `${setId}-${index + 1}`,
      label: `Dé ${index + 1}`,
      sides: definition.sides,
      ...(roll?.values[index] == null ? {} : { value: roll.values[index] }),
    })),
    ...(roll
      ? {
          total: roll.total,
          rollKey: `${turnNumber}:${roll.values.join('-')}`,
        }
      : {}),
  };
  return extras;
}
