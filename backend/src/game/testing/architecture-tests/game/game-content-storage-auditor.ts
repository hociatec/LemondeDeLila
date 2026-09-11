import type { GameState } from '../../../core/application/models/game-state.model';
import type { DeclarativeState } from '../../../engine/runtime/definitions/game-definition';

/** Installed games persist card identities; projections rehydrate their catalogues. */
export function assertContentReferences(state: GameState): void {
  const engine = (state as DeclarativeState<object>).engine;
  const cards = engine.kits.cards;
  if (cards) {
    const assertIds = (values: readonly unknown[]) => {
      if (
        values.some(
          (value) => typeof value !== 'string' && typeof value !== 'number',
        )
      ) {
        throw new Error('Persisted card contains static catalogue content');
      }
    };
    for (const collection of [cards.decks, cards.discards, cards.zones]) {
      for (const values of Object.values(collection)) assertIds(values);
    }
    for (const byPlayer of Object.values(cards.hands)) {
      for (const values of Object.values(byPlayer)) assertIds(values);
    }
  }
  for (const session of Object.values(engine.kits.quiz?.sessions ?? {})) {
    if ('question' in session || 'prompt' in session || 'choices' in session) {
      throw new Error(
        'Persisted quiz session contains static question content',
      );
    }
  }
  for (const key of ['content', 'components', 'catalogs', 'definition']) {
    if (key in engine) {
      throw new Error(`Persisted engine contains static ${key}`);
    }
  }
}
