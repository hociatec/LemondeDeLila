import type { QueryRunner } from 'typeorm';
import { SplitGameSessionTimeline1770400000000 } from './1770400000000-SplitGameSessionTimeline';

describe('SplitGameSessionTimeline migration', () => {
  it('migrates representative existing events and snapshots before dropping JSON', async () => {
    const executed: Array<{ sql: string; params?: unknown[] }> = [];
    const timeline = {
      initial: { seq: 0, version: 1, state: { status: 'started' } },
      events: [
        {
          seq: 1,
          version: 2,
          actorId: 7,
          occurredAtMs: 10,
          type: 'engine.state.committed',
          data: { patch: [] },
          visibility: { kind: 'internal' },
        },
      ],
      snapshots: [
        { seq: 0, version: 1, state: { status: 'started' } },
        { seq: 1, version: 2, state: { status: 'finished' } },
      ],
    };
    const runner = {
      createTable: jest.fn(),
      hasColumn: jest.fn().mockResolvedValue(true),
      dropColumn: jest.fn(),
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        executed.push({ sql, params });
        if (sql.startsWith('SELECT room_id')) {
          return [
            {
              room_id: 4,
              game_type: 'lama',
              state: timeline.initial.state,
              timeline: JSON.stringify(timeline),
            },
          ];
        }
        return [];
      }),
    } as unknown as QueryRunner;

    await new SplitGameSessionTimeline1770400000000().up(runner);

    expect(
      executed.filter((entry) =>
        entry.sql.startsWith('INSERT INTO game_session_events'),
      ),
    ).toHaveLength(1);
    expect(
      executed.filter((entry) =>
        entry.sql.startsWith('INSERT INTO game_session_snapshots'),
      ),
    ).toHaveLength(2);
    expect(runner.dropColumn).toHaveBeenCalledWith('game_sessions', 'timeline');
  });
});
