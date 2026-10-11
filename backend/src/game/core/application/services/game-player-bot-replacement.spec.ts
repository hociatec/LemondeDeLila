import type { GameState } from '../models/game-state.model';
import type { GameRoomPayload } from '../ports/game-room.port';
import { replaceDepartedPlayersWithBots } from './game-player-bot-replacement';
import { GameRoomStateLifecycle } from './game-room-state-lifecycle';

const room = () =>
  ({
    room: {
      id: 4,
      status: 'started',
      gameType: 'test',
      runId: 7,
      owner: { id: 2 },
      players: [{ id: 2, username: 'Lila' }],
      bots: [{ id: 9, name: 'Snorky' }],
    },
  }) as GameRoomPayload;
const state = (): GameState => ({
  version: 12,
  status: 'playing',
  phase: 'playing',
  log: [],
  players: [
    { id: 1, username: 'administrateur' },
    { id: 2, username: 'Lila' },
  ],
  metadata: {
    roomRunId: 7,
    roomOwnerId: 1,
    roomStartedAt: '2026-10-11T00:00:00Z',
  },
  turn: { currentPlayerId: 1, direction: 1, turnNumber: 8 },
  pending: { playerId: 1, type: 'choice', choices: ['A', 'B'] },
  game: { positions: { '1': 24, '2': 18 }, hands: { '1': [7], '2': [1] } },
});

it('hands the same seat, turn, choices and progress to the replacement bot', () => {
  const before = state();
  const after = replaceDepartedPlayersWithBots(before, room());
  expect(after.players?.[0]).toEqual({
    id: 1,
    username: 'Snorky',
    isBot: true,
    replacementBotPlayerId: -9,
  });
  expect(after.turn).toEqual(before.turn);
  expect(after.pending).toEqual(before.pending);
  expect(after.game).toEqual(before.game);
  expect(after.status).toBe('playing');
  expect(after.metadata?.roomRunId).toBe(7);
  expect(after.metadata?.roomOwnerId).toBe(2);
  expect(before.players?.[0].isBot).toBeUndefined();
  expect(replaceDepartedPlayersWithBots(after, room())).toBe(after);
});

it('does not reuse an existing bot or alter a finished game or lobby', () => {
  const before = state();
  before.players?.push({ id: -9, username: 'Snorky', isBot: true });
  expect(replaceDepartedPlayersWithBots(before, room())).toBe(before);
  const finished = { ...state(), status: 'finished' };
  expect(replaceDepartedPlayersWithBots(finished, room())).toBe(finished);
  const lobby = room();
  lobby.room.status = 'setup';
  expect(replaceDepartedPlayersWithBots(before, lobby)).toBe(before);
});

it('persists and broadcasts the takeover once without resetting the run', async () => {
  let current = state();
  const engine = {
    exportInternalState: jest.fn(async () => current),
    compareAndSetInternalState: jest.fn(
      async (_roomId, _gameType, _version, next) => {
        current = { ...next, version: 13 };
        return { committed: true, state: current, version: 13 };
      },
    ),
    clearInternalState: jest.fn(),
    restoreInternalState: jest.fn(),
  };
  const publish = jest.fn();
  const automation = { schedule: jest.fn() };
  const lifecycle = new GameRoomStateLifecycle(
    {} as never,
    engine as never,
    { getHandler: () => ({}) } as never,
    automation as never,
    { buildPayload: async () => room() } as never,
    {} as never,
    publish,
  );
  const resolved = await lifecycle.resolve(4);
  lifecycle.schedule(4, resolved);
  expect(resolved.state.players?.[0].isBot).toBe(true);
  expect(engine.compareAndSetInternalState).toHaveBeenCalledWith(
    4,
    'test',
    12,
    expect.objectContaining({ status: 'playing' }),
    null,
  );
  expect(publish).toHaveBeenCalledTimes(1);
  expect(automation.schedule).toHaveBeenCalledWith(
    expect.objectContaining({ state: current }),
  );
  await lifecycle.resolve(4);
  expect(engine.compareAndSetInternalState).toHaveBeenCalledTimes(1);
  expect(engine.clearInternalState).not.toHaveBeenCalled();
  expect(engine.restoreInternalState).not.toHaveBeenCalled();
});
