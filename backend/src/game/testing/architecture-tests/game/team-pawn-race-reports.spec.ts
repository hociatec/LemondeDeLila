import { compileJsonGame } from '../../../rules/public-api';
import {
  DeclarativeGameRuntime,
  testGame,
} from '../../../engine/testing/public-api';
import {
  FixedGameClock,
  StateGameRng,
} from '../../../core/application/models/game-execution-context.model';
import type {
  DeclarativeState,
  MutableEngineKitsState,
} from '../../../engine/runtime/state/declarative-state';
import manifest from '../../../games/vents-sacres/foulees-fantastiques/manifest.json';
import document from '../../../games/vents-sacres/foulees-fantastiques/game.json';
import catalogue from '../../../games/vents-sacres/foulees-fantastiques/catalogue.json';
import { GameRoomStateFactory } from '../../../core/application/services/game-room-state.factory';

const definition = compileJsonGame(manifest, document, {
  'content/catalogue.json': catalogue,
});
const runtime = new DeclarativeGameRuntime(definition);
type State = DeclarativeState<Record<string, never>> & {
  engine: { kits: MutableEngineKitsState };
};

async function fixture() {
  const game = await testGame(definition)
    .players(['Anne', 'Bob', 'Cécile', 'David'])
    .seed(44)
    .start();
  for (const [index, family] of catalogue.families.entries()) {
    expect(game.state().pending?.playerId).toBe(index + 1);
    await game.choose(index + 1, family.id);
  }
  return game.state() as State;
}

function roll(state: State, total: number, actorId = 1) {
  state.turn!.currentPlayerId = actorId;
  state.engine.pendingEvents = [];
  for (let seed = 1; ; seed++) {
    state.metadata = { ...state.metadata, rng: { seed, counter: 0 } };
    if (new StateGameRng(structuredClone(state)).int(6) + 1 === total) break;
  }
  const rng = new StateGameRng(state);
  return runtime.applyActions(
    state,
    [{ type: 'roll', payload: {}, meta: { actorId } }],
    {
      actorId,
      rng,
      clock: new FixedGameClock(1_700_000_000_000),
    },
  ) as State;
}

function messages(state: State, key: string) {
  return (
    state.engine.pendingEvents
      ?.filter(
        (event) => event.type === 'game.message' && event.data.key === key,
      )
      .map((event) => event.data) ?? []
  );
}

it('lets the owner choose first despite randomized runtime player order', () => {
  const base = new GameRoomStateFactory().build(
    {
      room: {
        id: 1,
        status: 'started',
        startedAt: '2026-10-12T10:00:00Z',
        owner: { id: 20 },
        players: [
          { id: 30, username: 'Second' },
          { id: 20, username: 'Owner' },
          { id: 10, username: 'Third' },
        ],
        bots: [],
      },
    },
    definition.id,
  );
  expect(
    Object.fromEntries(
      base.players!.map((player) => [player.id, player.seatIndex]),
    ),
  ).toEqual({ 20: 0, 30: 1, 10: 2 });
  base.players!.sort((left, right) => left.id - right.id);
  let state = runtime.hydrateInitialState(base);
  expect(state.pending?.playerId).toBe(20);
  state = runtime.applyActions(state, [
    {
      type: 'choice.resolve',
      payload: { value: 'equides' },
      meta: { actorId: 20 },
    },
  ]);
  expect(state.pending?.playerId).toBe(30);
  state = runtime.applyActions(state, [
    {
      type: 'choice.resolve',
      payload: { value: 'primates' },
      meta: { actorId: 30 },
    },
  ]);
  expect(state.pending?.playerId).toBe(10);
});

it.each([1, 2, 3, 4])(
  'starts seat %i at its actual board square',
  async (seat) => {
    let state = roll(await fixture(), 6, seat);
    const pawn = `${catalogue.families[seat - 1].id}:0`;
    expect(JSON.stringify(state.pending)).toContain(
      `en case ${1 + (seat - 1) * 13}`,
    );
    state = runtime.applyActions(state, [
      {
        type: 'choice.resolve',
        payload: { value: `${pawn}:0` },
        meta: { actorId: seat },
      },
    ]) as State;
    expect(
      messages(state, 'game.team-pawn.moved').at(-1)?.params,
    ).toMatchObject({ position: 1 + (seat - 1) * 13 });
    expect(JSON.stringify(messages(state, 'game.dice.rolled'))).toContain(
      'Rejouez.',
    );
  },
);

it.each([1, 2, 3, 4, 5, 6])(
  'requires each residence die value, rolling %i',
  async (total) => {
    const source = await fixture();
    for (let from = 51; from <= 55; from++) {
      const state = structuredClone(source);
      const positions = state.engine.kits.pawns!.positions.teamPawn;
      for (const pawn of state.engine.kits.pawns!.assignments.teamPawn['1'])
        positions[pawn] = 55;
      positions['equides:0'] = from;
      const result = roll(state, total);
      const moves = from < 55 && total === from - 50;
      expect(result.engine.kits.pawns!.positions.teamPawn['equides:0']).toBe(
        moves ? from + 1 : from,
      );
      const narration = JSON.stringify(
        messages(result, 'game.team-pawn.moved'),
      );
      expect(narration).not.toMatch(/case 5[3-6]/);
      if (moves)
        expect(narration).toContain(
          ['première', 'seconde', 'troisième', 'quatrième'][from - 51] +
            ' résidence',
        );
      else
        expect(JSON.stringify(messages(result, 'game.dice.rolled'))).toContain(
          'Vous ne pouvez pas avancer.',
        );
      if (moves && from === 54) expect(result.status).toBe('finished');
    }
  },
);

it('cannot skip the last track square to enter a residence', async () => {
  const source = await fixture();
  for (const pawn of source.engine.kits.pawns!.assignments.teamPawn['1'])
    source.engine.kits.pawns!.positions.teamPawn[pawn] = 55;
  source.engine.kits.pawns!.positions.teamPawn['equides:0'] = 50;
  expect(
    roll(structuredClone(source), 2).engine.kits.pawns!.positions.teamPawn[
      'equides:0'
    ],
  ).toBe(50);
  expect(
    roll(source, 1).engine.kits.pawns!.positions.teamPawn['equides:0'],
  ).toBe(51);
});

it.each(
  catalogue.families.map((family, index) => ({ family, seat: index + 1 })),
)('returns captured $family.id to its habitat', async ({ family, seat }) => {
  const state = await fixture();
  const attacker = seat === 1 ? 2 : 1;
  const attackerFamily = catalogue.families[attacker - 1].id;
  // All players meet on physical square 11, which is not protected.
  const positions = state.engine.kits.pawns!.positions.teamPawn;
  positions[`${attackerFamily}:0`] = (9 - (attacker - 1) * 13 + 52) % 52;
  positions[`${family.id}:0`] = (10 - (seat - 1) * 13 + 52) % 52;
  const result = roll(state, 1, attacker);
  expect(result.engine.kits.pawns!.positions.teamPawn[`${family.id}:0`]).toBe(
    -1,
  );
  const narration = JSON.stringify(messages(result, 'game.team-pawn.captured'));
  expect(narration).toContain(family.habitat);
  expect(narration).not.toContain('réserve');
});
