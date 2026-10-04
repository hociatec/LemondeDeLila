import {
  DeclarativeGameRuntime,
  testGame,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';

import catalogue from './catalogue.json';
import documentExtensionSource from './game.json';
import manifest from './manifest.json';
const document = documentExtensionSource;

const gameDefinition = compileJsonGame(manifest, document, {
  'content/catalogue.json': catalogue,
});

describe('En Attendant Minuit declarative game', () => {
  it('waits for a manual draw and exposes a complete, separate quiz', async () => {
    const game = await testGame(gameDefinition)
      .players(['Lila', 'Mina'])
      .seed(111)
      .start();
    await game.choose(1, 'lutin');
    await game.choose(2, 'renne');
    const state: any = game.state();
    const actorId = state.turn.currentPlayerId;
    state.engine.playerValues.statuses[actorId] = [
      {
        id: 'race-bounce-quiz.force-draw-next-turn',
        remaining: null,
        scope: 'until-used',
        data: {},
      },
    ];
    const deck = state.engine.kits.cards.decks.noel;
    state.engine.kits.cards.decks.noel = [
      43,
      ...deck.filter((id: number) => id !== 43),
    ];
    const runtime = new DeclarativeGameRuntime(gameDefinition);
    const awaitingDraw: any = runtime.applyActions(state, [
      { type: 'roll', payload: {}, meta: { actorId } },
    ]);
    expect(awaitingDraw.engine.kits.cards.decks.noel).toHaveLength(
      catalogue.cards.length,
    );
    expect(
      awaitingDraw.log.some(
        (entry: any) => entry.key === 'game.card.draw-required',
      ),
    ).toBe(true);
    const pending: any = runtime.applyActions(awaitingDraw, [
      { type: 'draw_card', payload: {}, meta: { actorId } },
    ]);
    expect(pending.engine.kits.cards.decks.noel).toHaveLength(
      catalogue.cards.length - 1,
    );
    expect(pending.pending?.question).toBe(
      'Quelle célébrité américaine a popularisé pour la première fois la chanson White Christmas dans les années 1940 ?',
    );
    expect(pending.pending?.choices).toEqual([
      'Frank Sinatra',
      'Bing Crosby',
      'Dean Martin',
    ]);
    const drawn = pending.log.find(
      (entry: any) =>
        entry.key === 'game.card.drawn' && entry.params.cardId === 43,
    );
    expect(drawn?.params.cardLabel).toBe('Noël blanc');
    expect(drawn?.params.effectDescription).toBe('');
    expect(JSON.stringify(pending)).not.toContain('remarque :');
  });
});
