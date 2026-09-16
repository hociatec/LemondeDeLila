import { compileJsonGame } from '../../../engine/json/public-api';
import {
  DeclarativeGameRuntime,
  testGame,
} from '../../../engine/testing/public-api';
import catalogue from './content/catalogue.json';
import document from './game.json';
import manifest from './manifest.json';

const definition = compileJsonGame(manifest, document, {
  'content/catalogue.json': catalogue,
});
const runtime = new DeclarativeGameRuntime(definition);
const prefix = 'choice-story-challenge.';
async function fixture() {
  const game = testGame(definition)
    .players(['Alice', 'Bob', 'Charlie'])
    .seed(127);
  await game.start();
  for (let id = 1; id <= 3; id++)
    await game.choose(id, catalogue.pawns[id - 1].id);
  const state: any = game.state();
  for (let id = 1; id <= 3; id++)
    state.engine.playerValues.statuses[id] = [
      {
        id: prefix + 'forced-one',
        remaining: null,
        scope: 'until-used',
        data: {},
      },
    ];
  return state;
}
function act(state: any, actorId: number, type: string, payload = {}) {
  return runtime.applyActions(state, [
    { type, payload, meta: { actorId } },
  ]) as any;
}
function top(state: any, deck: string, ids: number[]) {
  const cards = state.engine.kits.cards.decks[deck];
  state.engine.kits.cards.decks[deck] = [
    ...ids,
    ...cards.filter((id: number) => !ids.includes(id)),
  ];
}

describe('Contes reports: chained cards and blocked turns', () => {
  it('declares separate position and race-ranking shortcuts', () => {
    const shortcuts = runtime.getShortcuts();
    expect(shortcuts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'P',
          type: 'interface',
          id: 'position',
        }),
        expect.objectContaining({
          key: 'S',
          type: 'interface',
          id: 'race-ranking',
        }),
      ]),
    );
    expect(shortcuts.filter((shortcut) => shortcut.key === 'S')).toHaveLength(
      1,
    );
  });
  it('finishes both chest draws even when laughter interrupts the first one', async () => {
    const base = await fixture();
    let interrupted = 0;
    for (let seed = 1; seed <= 12; seed++) {
      let state = structuredClone(base);
      state.metadata.rng = { seed, counter: 0 };
      state.engine.kits.movement.positions['story-road'] = {
        '1': 2,
        '2': 0,
        '3': 0,
      };
      top(state, 'surprise', [4, 5, 8]);
      top(state, 'bonus', [3, 4]);
      top(state, 'malus', [1]);
      state = act(state, 1, 'roll');
      if (state.pending) interrupted++;
      for (let choices = 0; state.pending && choices < 8; choices++) {
        const actor = state.pending.playerId;
        state = act(state, actor, 'choice.resolve', {
          value: actor === 1 ? 3 : 1,
        });
      }
      expect(state.pending).toBeNull();
      const drawn = ['bonus', 'malus', 'surprise'].reduce(
        (n, deck) => n + state.engine.kits.cards.discards[deck].length,
        0,
      );
      expect(drawn).toBe(3);
      expect(state.turn.currentPlayerId).not.toBe(1);
    }
    expect(interrupted).toBeGreaterThan(0);
  });

  it('resolves both bridge cards across a target choice and keeps the reversed next turn', async () => {
    let state = await fixture();
    top(state, 'bonus', [9, 10]);
    top(state, 'surprise', [8]);
    state = act(state, 1, 'roll');
    expect(state.pending?.playerId).toBe(1);
    state = act(state, 1, 'choice.resolve', { value: 2 });
    expect(state.pending).toBeNull();
    expect(state.engine.kits.cards.discards.bonus).toEqual(
      expect.arrayContaining([9, 10]),
    );
    expect(state.engine.kits.cards.discards.surprise).toContain(8);
    expect(
      state.engine.playerValues.statuses['1'].some(
        (s: any) => s.id === prefix + 'reverse-next-turn',
      ),
    ).toBe(true);
    expect(state.turn.currentPlayerId).toBe(1); // Alice plays Bob's next slot.
    state = act(state, 1, 'roll');
    expect(state.engine.kits.movement.positions['story-road']['1']).toBe(0);
  });

  it('skips the wolf-blocked player without blocking the following player', async () => {
    let state = await fixture();
    state.engine.kits.movement.positions['story-road'] = {
      '1': 4,
      '2': 0,
      '3': 0,
    };
    top(state, 'malus', [5]);
    top(state, 'bonus', [3, 4]);
    state = act(state, 1, 'roll');
    expect(state.turn.currentPlayerId).toBe(2);
    state = act(state, 2, 'roll');
    state = act(state, 3, 'roll');
    expect(state.turn.currentPlayerId).toBe(2);
    expect(
      runtime.getAvailableActions(state, 2).some((a) => a.type === 'roll'),
    ).toBe(true);
  });
});
