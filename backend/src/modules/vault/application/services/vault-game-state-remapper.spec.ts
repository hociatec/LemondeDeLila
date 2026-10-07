import { remapVaultGameState } from './vault-game-state-remapper';

const options = {
  roomId: 10,
  roomOwnerId: 42,
  roomStartedAt: null,
  roomRunId: null,
  botIdMap: new Map([
    [-1, -2],
    [-2, -3],
  ]),
  botNamesByNewId: new Map([
    [-2, 'A'],
    [-3, 'B'],
  ]),
};

it('remaps identities exactly once while preserving direction, positions, scores, card IDs and arbitrary values', () => {
  const source = {
    status: 'started',
    players: [{ id: -1 }, { id: -2 }],
    turn: {
      currentPlayerId: -1,
      direction: -1,
      skippedPlayerIds: [-2],
      scheduledTurnReplacements: { '-1': -2 },
    },
    game: { score: -1, offset: -2, '-1': -2 },
    engine: {
      playerValues: {
        scores: { '-1': -2, '-2': -1 },
        resources: { coins: { '-1': -1 } },
      },
      kits: {
        movement: { positions: { track: { '-1': -1 } } },
        pawns: {
          owners: { pieces: { '-1': -2 } },
          positions: { pieces: { '-1': -1 } },
        },
        cards: { hands: { hand: { '-1': [{ id: -1, value: -2 }] } } },
        quiz: {
          sessions: {
            quiz: { participantPlayerIds: [-1], answers: { '-1': 0 } },
          },
        },
      },
      match: { result: { winnerPlayerIds: [-1], ranking: [[-1], [-2]] } },
      submissions: {
        sessions: {
          vote: {
            participantPlayerIds: [-1],
            valueOrder: [-1],
            valuesByPlayerId: { '-1': -1 },
          },
        },
      },
    },
  };
  const restored: any = remapVaultGameState(source, options);
  expect(restored.players).toEqual([
    { id: -2, username: 'A' },
    { id: -3, username: 'B' },
  ]);
  expect(restored.turn).toEqual({
    currentPlayerId: -2,
    direction: -1,
    skippedPlayerIds: [-3],
    scheduledTurnReplacements: { '-2': -3 },
  });
  expect(restored.game).toEqual(source.game);
  expect(restored.engine.playerValues.scores).toEqual({ '-2': -2, '-3': -1 });
  expect(restored.engine.playerValues.resources.coins).toEqual({ '-2': -1 });
  expect(restored.engine.kits.movement.positions.track).toEqual({ '-2': -1 });
  expect(restored.engine.kits.pawns).toEqual({
    owners: { pieces: { '-1': -3 } },
    positions: { pieces: { '-1': -1 } },
  });
  expect(restored.engine.kits.cards.hands.hand).toEqual({
    '-2': [{ id: -1, value: -2 }],
  });
  expect(restored.engine.kits.quiz.sessions.quiz.answers).toEqual({ '-2': 0 });
  expect(restored.engine.match.result.ranking).toEqual([[-2], [-3]]);
  expect(restored.engine.submissions.sessions.vote).toEqual({
    participantPlayerIds: [-2],
    valueOrder: [-2],
    valuesByPlayerId: { '-2': -1 },
  });
  expect(source.players).toEqual([{ id: -1 }, { id: -2 }]);
});

it('remaps player choices and timeouts but preserves numeric choices in pending queues', () => {
  const restored: any = remapVaultGameState(
    {
      status: 'started',
      pending: {
        playerId: -1,
        data: { kind: 'player', options: [-1, -2], timeoutValue: -1 },
        queue: [
          {
            playerId: -2,
            data: { kind: 'number', options: [-1, -2], timeoutValue: -1 },
          },
        ],
      },
    },
    options,
  );
  expect(restored.pending.data).toEqual({
    kind: 'player',
    options: [-2, -3],
    timeoutValue: -2,
  });
  expect(restored.pending.queue[0]).toEqual({
    playerId: -3,
    data: { kind: 'number', options: [-1, -2], timeoutValue: -1 },
  });
});
