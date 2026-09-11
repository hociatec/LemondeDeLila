import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm';

type LegacyTimelineEvent = { seq: number; version: number };
type LegacyTimelineSnapshot = {
  seq: number;
  version: number;
  state: unknown;
};
type LegacyGameTimeline = {
  initial?: LegacyTimelineSnapshot | null;
  events?: LegacyTimelineEvent[];
  snapshots?: LegacyTimelineSnapshot[];
};

type LegacySessionRow = {
  room_id: number;
  game_type: string;
  state: unknown;
  timeline: LegacyGameTimeline | string | null;
};

export class SplitGameSessionTimeline1770400000000 implements MigrationInterface {
  name = 'SplitGameSessionTimeline1770400000000';

  private static readonly ROW_BATCH_SIZE = 250;
  private static readonly MAX_TIMELINE_ITEMS = 100_000;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(eventTable(), true);
    await queryRunner.createTable(snapshotTable(), true);
    if (!(await queryRunner.hasColumn('game_sessions', 'timeline'))) return;

    for (let offset = 0; ; offset += SplitGameSessionTimeline1770400000000.ROW_BATCH_SIZE) {
      const rows = (await queryRunner.query(
        'SELECT room_id, game_type, state, timeline FROM game_sessions ORDER BY room_id ASC, game_type ASC LIMIT ? OFFSET ?',
        [SplitGameSessionTimeline1770400000000.ROW_BATCH_SIZE, offset],
      )) as LegacySessionRow[];
      if (rows.length === 0) break;
      for (const row of rows) {
      const timeline = parseTimeline(row.timeline);
      if (!timeline) continue;
      for (const event of (timeline.events ?? []).slice(
        0,
        SplitGameSessionTimeline1770400000000.MAX_TIMELINE_ITEMS,
      )) {
        await queryRunner.query(
          'INSERT INTO game_session_events (room_id, game_type, seq, version, event) VALUES (?, ?, ?, ?, ?)',
          [
            row.room_id,
            row.game_type,
            event.seq,
            event.version,
            JSON.stringify(event),
          ],
        );
      }
      const snapshots =
        (timeline.snapshots?.length ?? 0) > 0
          ? (timeline.snapshots ?? []).slice(
              0,
              SplitGameSessionTimeline1770400000000.MAX_TIMELINE_ITEMS,
            )
          : timeline.initial
            ? [timeline.initial]
            : [];
      for (const snapshot of snapshots) {
        await queryRunner.query(
          'INSERT INTO game_session_snapshots (room_id, game_type, seq, version, state) VALUES (?, ?, ?, ?, ?)',
          [
            row.room_id,
            row.game_type,
            snapshot.seq,
            snapshot.version,
            JSON.stringify(snapshot.state),
          ],
        );
      }
      }
    }
    await queryRunner.dropColumn('game_sessions', 'timeline');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('game_sessions', 'timeline'))) {
      await queryRunner.addColumn(
        'game_sessions',
        new TableColumn({ name: 'timeline', type: 'json', isNullable: true }),
      );
    }
    for (let offset = 0; ; offset += SplitGameSessionTimeline1770400000000.ROW_BATCH_SIZE) {
      const sessions = (await queryRunner.query(
        'SELECT room_id, game_type, state FROM game_sessions ORDER BY room_id ASC, game_type ASC LIMIT ? OFFSET ?',
        [SplitGameSessionTimeline1770400000000.ROW_BATCH_SIZE, offset],
      )) as LegacySessionRow[];
      if (sessions.length === 0) break;
      for (const session of sessions) {
      const events = await queryRunner.query(
        'SELECT event FROM game_session_events WHERE room_id = ? AND game_type = ? ORDER BY seq ASC LIMIT ?',
        [
          session.room_id,
          session.game_type,
          SplitGameSessionTimeline1770400000000.MAX_TIMELINE_ITEMS,
        ],
      );
      const snapshots = await queryRunner.query(
        'SELECT seq, version, state FROM game_session_snapshots WHERE room_id = ? AND game_type = ? ORDER BY seq ASC LIMIT ?',
        [
          session.room_id,
          session.game_type,
          SplitGameSessionTimeline1770400000000.MAX_TIMELINE_ITEMS,
        ],
      );
      const normalizedSnapshots = snapshots.map(
        (row: Record<string, unknown>) => ({
          seq: Number(row.seq),
          version: Number(row.version),
          state: parseJson(row.state),
        }),
      );
      const initial = normalizedSnapshots[0] ?? {
        seq: 0,
        version: 1,
        state: parseJson(session.state),
      };
      await queryRunner.query(
        'UPDATE game_sessions SET timeline = ? WHERE room_id = ? AND game_type = ?',
        [
          JSON.stringify({
            initial,
            events: events.map((row: Record<string, unknown>) =>
              parseJson(row.event),
            ),
            snapshots: normalizedSnapshots.length
              ? normalizedSnapshots
              : [initial],
          }),
          session.room_id,
          session.game_type,
        ],
      );
      }
    }
    await queryRunner.dropTable('game_session_snapshots', true);
    await queryRunner.dropTable('game_session_events', true);
  }
}

function eventTable(): Table {
  return new Table({
    name: 'game_session_events',
    columns: [
      { name: 'room_id', type: 'int', unsigned: true, isPrimary: true },
      { name: 'game_type', type: 'varchar', length: '120', isPrimary: true },
      { name: 'seq', type: 'int', unsigned: true, isPrimary: true },
      { name: 'version', type: 'int', unsigned: true },
      { name: 'event', type: 'json' },
    ],
    indices: [
      {
        name: 'IDX_game_session_events_version',
        columnNames: ['room_id', 'game_type', 'version'],
      },
    ],
  });
}

function snapshotTable(): Table {
  return new Table({
    name: 'game_session_snapshots',
    columns: [
      { name: 'room_id', type: 'int', unsigned: true, isPrimary: true },
      { name: 'game_type', type: 'varchar', length: '120', isPrimary: true },
      { name: 'seq', type: 'int', unsigned: true, isPrimary: true },
      { name: 'version', type: 'int', unsigned: true },
      { name: 'state', type: 'json' },
    ],
    indices: [
      {
        name: 'IDX_game_session_snapshots_version',
        columnNames: ['room_id', 'game_type', 'version'],
      },
    ],
  });
}

function parseTimeline(
  value: LegacyGameTimeline | string | null,
): LegacyGameTimeline | null {
  const parsed = parseJson(value);
  return parsed && typeof parsed === 'object' ? parsed : null;
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
