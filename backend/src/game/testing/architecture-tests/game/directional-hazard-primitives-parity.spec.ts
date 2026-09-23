import { compileJsonGame } from '../../../rules/public-api';
import { testGame } from '../../../engine/testing/public-api';
import type { GameEffectInstruction } from '../../../engine/runtime/contracts/effect-ir';
import type { DeclarativeState } from '../../../engine/runtime/state/declarative-state';
import type { GameState } from '../../../core/application/models/game-state.model';
import manifest from '../../../games/les-quatre-vents/ca-derape/manifest.json';
import document from '../../../games/les-quatre-vents/ca-derape/game.json';
import catalogue from '../../../games/les-quatre-vents/ca-derape/catalogue.json';

const legacy: Record<number, GameEffectInstruction> = {
  21: { kind: 'custom', effectId: 'race-hazard.skip-penalty', data: {} },
  23: { kind: 'custom', effectId: 'race-hazard.skip-penalty', data: {} },
  25: { kind: 'custom', effectId: 'race-hazard.skip-penalty', data: {} },
  31: { kind: 'custom', effectId: 'race-hazard.skip-penalty', data: {} },
  58: {
    kind: 'custom',
    effectId: 'race-hazard.conditional',
    data: { effect: 'replay' },
  },
  63: {
    kind: 'custom',
    effectId: 'race-hazard.rule',
    data: { effect: 'double-move' },
  },
  65: {
    kind: 'custom',
    effectId: 'race-hazard.rule',
    data: { effect: 'shield' },
  },
};

function definition(historical: boolean) {
  const actions = Object.fromEntries(
    catalogue.cards
      .filter((card) => Object.hasOwn(legacy, card.id))
      .map((card) => [
        `card${card.id}`,
        {
          effects: historical
            ? [legacy[card.id], ...card.effects.slice(1)]
            : card.effects,
        },
      ]),
  );
  actions.protect = {
    effects: [{ kind: 'add-status', status: 'shield', scope: 'until-used' }],
  };
  return compileJsonGame(
    manifest,
    {
      ...document,
      shortcuts: [],
      actions,
      phases: { playing: { actions: Object.keys(actions), terminal: true } },
    },
    { 'content/catalogue.json': catalogue },
  );
}

const oldDefinition = definition(true);
const newDefinition = definition(false);

function comparable(state: GameState) {
  // Content fingerprints differ by construction; each independent session also
  // receives its own infrastructure restoration epoch. All gameplay is compared.
  const { restoreId: _restoreId, ...metadata } = state.metadata ?? {};
  const { contentDigest: _digest, ...engine } = (
    state as DeclarativeState<object>
  ).engine;
  return { ...state, engine, metadata };
}

describe.each([false, true])(
  'composed hazard effects (shield=%s)',
  (shield) => {
    it.each(Object.keys(legacy).map(Number))(
      'card %i matches its historical handler and replays',
      async (cardId) => {
        const games = [oldDefinition, newDefinition].map((def) =>
          testGame(def).players(['Lila', 'Mina', 'Leo']).seed(91),
        );
        for (const game of games) {
          await game.start();
          const actor = game.state().turn?.currentPlayerId;
          if (actor == null) throw new Error('Missing current player');
          if (shield) await game.as(actor).do('protect', {});
          await game.as(actor).do(`card${cardId}`, {});
        }
        expect(comparable(games[1].state())).toEqual(
          comparable(games[0].state()),
        );
        // A consumed shield must not protect a second penalty.
        if ([21, 23, 25, 31].includes(cardId)) {
          for (const game of games) {
            const actor = game.state().turn?.currentPlayerId;
            if (actor == null) throw new Error('Missing current player');
            await game.as(actor).do(`card${cardId}`, {});
          }
          expect(comparable(games[1].state())).toEqual(
            comparable(games[0].state()),
          );
        }
        for (const game of games)
          expect(await game.replay()).toEqual(game.state());
      },
    );
  },
);
