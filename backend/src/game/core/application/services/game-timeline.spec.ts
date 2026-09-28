import {
  appendGameTimelineCommit,
  createGameTimeline,
} from './game-timeline';

describe('game timeline bounds', () => {
  const snapshotPolicy = { maxStateBytes: 1024 * 1024 };
  const state = { version: 1, players: [] };

  it('rejects a commit beyond the event timeline limit', () => {
    const timeline = createGameTimeline(state);
    timeline.events = new Array(100_000) as typeof timeline.events;

    expect(() =>
      appendGameTimelineCommit({
        timeline,
        previous: state,
        next: { ...state, version: 2 },
        pendingEvents: [],
        occurredAtMs: 0,
        snapshotPolicy,
      }),
    ).toThrow('Game timeline too long');
  });

  it('evicts the oldest snapshot at the snapshot timeline limit', () => {
    const timeline = createGameTimeline(state);
    timeline.snapshots = Array.from({ length: 1000 }, (_, index) => ({
      seq: index,
      version: 1,
      state,
    }));
    timeline.events = Array.from({ length: 1000 }, (_, index) => ({
      seq: index + 1,
    })) as typeof timeline.events;

    const result = appendGameTimelineCommit({
      timeline,
      previous: state,
      next: { ...state, version: 2 },
      pendingEvents: [],
      occurredAtMs: 0,
      snapshotPolicy: { ...snapshotPolicy, everyEvents: 1 },
    });

    expect(result.snapshots).toHaveLength(1000);
    expect(result.snapshots[0]?.seq).toBe(1);
  });
});
