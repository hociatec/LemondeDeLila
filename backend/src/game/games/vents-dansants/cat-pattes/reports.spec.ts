import { legacyExtensionFixture } from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import {
  DeclarativeGameRuntime,
  testGame,
} from '../../../engine/testing/public-api';
import catalogue from './content/cat-pattes.json';
import documentExtensionSource from './game.json';
import manifest from './manifest.json';
const document = legacyExtensionFixture(documentExtensionSource, 'pawScoring');

const definition = compileJsonGame(manifest, document, {
  'content/cat-pattes.json': catalogue,
});
const runtime = new DeclarativeGameRuntime(definition);
const prefix = catalogue.statusPrefix;
async function fixture(obstacle?: string) {
  const game = testGame(definition).players(['Alice', 'Bob']).seed(71);
  await game.start();
  await game.as(1).do('game.configure', { roundsToPlay: 1 });
  const state: any = game.state();
  state.engine.playerValues.statuses['1'] = [
    status('has-sun'),
    status('sun-not-ready'),
  ];
  if (obstacle)
    state.engine.playerValues.statuses['1'].push(
      status('obstacle', { obstacle }),
    );
  state.engine.kits.cards.hands[catalogue.handId]['1'] = catalogue.cards.map(
    (c) => c.id,
  );
  return act(state, 'draw');
}
function status(id: string, data = {}) {
  return { id: prefix + id, scope: 'round', remaining: null, data };
}
function act(state: any, type: string, payload = {}) {
  return runtime.applyActions(state, [
    { type, payload, meta: { actorId: 1 } },
  ]) as any;
}
function playable(state: any) {
  return runtime
    .getAvailableActions(state, 1)
    .filter((a) => a.type === 'play_card')
    .map((a) => a.payload?.cardId);
}
describe('Cat Pattes reported rules', () => {
  it('allows only small paw cards on a waxed floor', async () => {
    const state = await fixture('sol');
    const legal = playable(state);
    for (const card of catalogue.cards.filter((c) => c.type === 'pattes'))
      expect(legal.includes(card.id)).toBe(Number(card.value) <= 50);
  });
  it.each(['gamelle', 'pluie', 'chien', 'coussin', 'sol'])(
    'only offers the matching parade for %s',
    async (obstacle) => {
      const legal = playable(await fixture(obstacle));
      const parade = {
        gamelle: 'croquettes',
        pluie: 'rayon',
        chien: 'dodo',
        coussin: 'coussin',
        sol: 'saut',
      }[obstacle];
      for (const card of catalogue.cards.filter((c) => c.type === 'parade'))
        expect(legal.includes(card.id)).toBe(card.parade === parade);
    },
  );
  it('requires sunshine again after each non-sun parade', async () => {
    for (const obstacle of ['gamelle', 'chien', 'coussin', 'sol']) {
      let state = await fixture(obstacle);
      const cardId = playable(state).find(
        (id) => catalogue.cards.find((c) => c.id === id)?.type === 'parade',
      );
      state = act(state, 'play_card', { cardId });
      state.turn.currentPlayerId = 1;
      state = act(state, 'draw');
      expect(
        playable(state).some(
          (id) => catalogue.cards.find((c) => c.id === id)?.type === 'pattes',
        ),
      ).toBe(false);
      expect(
        playable(state).some(
          (id) => catalogue.cards.find((c) => c.id === id)?.parade === 'rayon',
        ),
      ).toBe(true);
    }
  });
  it('limits Turbo-chat to two uses per round', async () => {
    const state = await fixture();
    state.engine.playerValues.resources[prefix + 'turbo-played'] = { '1': 2 };
    expect(
      playable(state).some(
        (id) => catalogue.cards.find((c) => c.id === id)?.value === 150,
      ),
    ).toBe(false);
  });

  it.each([
    ['gamelle', 'reserve'],
    ['chien', 'chat-ninja'],
    ['coussin', 'patte-blindee'],
    ['pluie', 'passage-star'],
    ['sol', 'passage-star'],
  ])('keeps %s permanently countered by %s', async (obstacle, power) => {
    let state = await fixture(obstacle);
    const card = catalogue.cards.find(
      (c) => c.type === 'bot' && c.bot === power,
    )!;
    expect(playable(state)).toContain(card.id);
    state = act(state, 'play_card', { cardId: card.id });
    expect(
      state.engine.playerValues.statuses['1'].some(
        (s: any) => s.id === prefix + 'obstacle',
      ),
    ).toBe(false);
    state.turn.currentPlayerId = 2;
    state.engine.kits.cards.hands[catalogue.handId]['2'] = catalogue.cards
      .filter((c) => c.type === 'obstacle')
      .map((c) => c.id);
    state = runtime.applyActions(state, [
      { type: 'draw', payload: {}, meta: { actorId: 2 } },
    ]);
    const legal = runtime
      .getAvailableActions(state, 2)
      .filter((a) => a.type === 'play_card');
    expect(
      legal.some(
        (a) =>
          catalogue.cards.find((c) => c.id === a.payload?.cardId)?.obstacle ===
          obstacle,
      ),
    ).toBe(false);
  });
});
