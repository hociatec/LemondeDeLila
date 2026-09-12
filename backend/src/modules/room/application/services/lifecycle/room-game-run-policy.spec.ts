import { isCurrentRoomGameRun } from './room-game-run-policy';

it.each([
  { status: 'started', persisted: 3, candidate: 3, current: true },
  { status: 'setup', persisted: 3, candidate: 4, current: true },
  { status: 'setup', persisted: 3, candidate: 3, current: false },
  { status: 'started', persisted: 4, candidate: 3, current: false },
  { status: 'finished', persisted: 3, candidate: 3, current: false },
])('resolves $status run $persisted against $candidate', (scenario) => {
  expect(
    isCurrentRoomGameRun(
      { gameType: 'game', status: scenario.status, runId: scenario.persisted },
      'game',
      scenario.candidate,
    ),
  ).toBe(scenario.current);
});

it('rejects removed rooms, replaced games and missing session run identifiers', () => {
  expect(isCurrentRoomGameRun(null, 'game', 1)).toBe(false);
  const room = { gameType: 'game', status: 'started', runId: 1 };
  expect(isCurrentRoomGameRun(room, 'other', 1)).toBe(false);
  expect(isCurrentRoomGameRun(room, 'game', null)).toBe(false);
});
