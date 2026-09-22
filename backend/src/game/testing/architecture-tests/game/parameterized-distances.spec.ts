import { Logger } from '@nestjs/common';
import { discoverGameDefinitions } from '../../../composition/game-module-discovery';
import { compileJsonGame } from '../../../rules/public-api';
import {
  testGame,
  DeclarativeGameRuntime,
} from '../../../engine/testing/public-api';

type Data = Record<string, any>;
function fixture(key: string) {
  const definition = discoverGameDefinitions().find(
    (item) => item.content?.data && key in item.content.data,
  );
  if (!definition) throw new Error('Missing mechanism fixture: ' + key);
  const document: Data = structuredClone(definition.content?.data);
  return {
    document,
    compile: () =>
      compileJsonGame(
        {
          code: 'parameter-test',
          engine: 'parameter-test',
          name: 'Parameter test',
          summary: 'Configured mechanisms',
          minPlayers: 2,
          maxPlayers: 4,
        },
        document,
      ),
  };
}
function action(document: Data, effectId: string, data = {}) {
  document.initialPhase = 'playing';
  document.phases.playing = { actions: ['probe'], terminal: true };
  document.actions.probe = { effects: [{ kind: 'custom', effectId, data }] };
}
beforeAll(() =>
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {}),
);
afterAll(() => jest.restoreAllMocks());

it.each(['correct', 'incorrect'])(
  'resolves a %s quiz from a nonlegacy deck with overlapping card IDs',
  async (answer) => {
    const { document, compile } = fixture('chapterEncounter');
    const program = document.chapterEncounter;
    const deck = program.collectionKinds.find(
      (kind: string) => kind !== program.legacyQuizDeckId,
    );
    const sharedId = program.decks[program.legacyQuizDeckId][0].id;
    const card = {
      ...program.decks[deck][0],
      id: sharedId,
      collectionGain: null,
      quiz: {
        choices: [
          { id: 'correct', label: 'Yes' },
          { id: 'incorrect', label: 'No' },
        ],
        answerId: 'correct',
        successDelta: 2,
      },
    };
    program.decks[deck] = [card];
    document.components.find(
      (component: Data) =>
        component.component === 'cards.deck' && component.id === deck,
    ).cards = [card];
    program.tiles.forEach((tile: Data, index: number) => {
      if (index > 0 && index < program.tiles.length - 1) tile.type = deck;
    });
    const game = testGame(compile()).players(2).seed(23);
    await game.start();
    await game.as(1).do('roll', {});
    const position = game.inspect.positions(program.trackId)['1'];
    await game.choose(1, answer);
    expect(game.resource(1, program.collectionResourcePrefix + deck)).toBe(
      answer === 'correct' ? 1 : 0,
    );
    expect(
      game.resource(
        1,
        program.collectionResourcePrefix + program.legacyQuizDeckId,
      ),
    ).toBe(0);
    expect(game.inspect.positions(program.trackId)['1']).toBe(
      position + (answer === 'correct' ? 2 : 0),
    );
    expect(game.inspect.discardCount(deck)).toBe(answer === 'correct' ? 0 : 1);
    expect(await game.replay()).toEqual(game.state());
  },
);

it('rejects a token referring to an undeclared resource', () => {
  const { document, compile } = fixture('storyChallenge');
  document.storyChallenge.tokens = [{ id: 'charge', resource: 'absent' }];
  expect(compile).toThrow(/unknown resource absent/);
});

it.each([
  [2, 8],
  [4, 2],
])(
  'uses checkpoint span 3 at position %i, including the failure branch',
  async (start, destination) => {
    const { document, compile } = fixture('directionalHazardRace');
    const program = document.directionalHazardRace;
    Object.assign(program.parameters, {
      checkpointSpan: 3,
      checkpointSuccess: 6,
      checkpointFailure: -2,
    });
    program.tiles.forEach((tile: Data) => {
      tile.isNeutral = true;
    });
    document.setup.tracks = { [program.trackId]: start };
    action(document, 'race-hazard.conditional', { effect: 'multiple-five' });
    const game = testGame(compile()).players(2);
    await game.start();
    await game.as(1).do('probe', {});
    expect(game.inspect.positions(program.trackId)['1']).toBe(destination);
    expect(await game.replay()).toEqual(game.state());
  },
);

it('uses the configured threshold movement amount', async () => {
  const { document, compile } = fixture('pairedPawnRace');
  const program = document.pairedPawnRace;
  program.rollMinimum = 1;
  program.rollAdvance = 3;
  for (const rule of Object.values(program.tileRules) as Data[])
    if (rule.kind !== 'finish') rule.kind = 'none';
  action(document, 'pairedPawn.roll-threshold-move');
  const game = testGame(compile()).players(2);
  await game.start();
  await game.as(1).do('probe', {});
  expect(game.inspect.positions(program.trackId)['1']).toBe(3);
  expect(await game.replay()).toEqual(game.state());
});

it('enumerates and accepts five answers while rejecting an index outside the current challenge', async () => {
  const { document, compile } = fixture('anonymousVote');
  document.anonymousVote.challenges.forEach((challenge: Data) => {
    challenge.answers = ['a', 'b', 'c', 'd', 'e'];
  });
  const definition = compile();
  const game = testGame(definition).players(3);
  await game.start();
  const choices = new DeclarativeGameRuntime(definition)
    .getAvailableActions(game.state(), 1)
    .filter((candidate) => candidate.payload?.answerIndex != null);
  expect(choices.map((candidate) => candidate.payload?.answerIndex)).toEqual([
    0, 1, 2, 3, 4,
  ]);
  const type = choices[0].type;
  await expect(game.as(1).do(type, { answerIndex: 5 })).rejects.toThrow();
  await game.as(1).do(type, { answerIndex: 4 });
  expect(await game.replay()).toEqual(game.state());
});
