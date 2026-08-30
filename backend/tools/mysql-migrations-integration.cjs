#!/usr/bin/env node
/* eslint-disable no-console */
require('ts-node/register');
require('tsconfig-paths/register');
const mysql = require('mysql2/promise');
const path = require('node:path');
const { DataSource } = require('typeorm');

const host = process.env.DB_HOST || '127.0.0.1';
const port = Number(process.env.DB_PORT || 3306);
const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASSWORD || '';
const database = `lmdl_migration_test_${process.pid}_${Date.now()}`;

async function main() {
  const admin = await mysql.createConnection({ host, port, user, password });
  if (!/^lmdl_migration_test_\d+_\d+$/.test(database)) {
    throw new Error('Nom de base temporaire invalide');
  }
  await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  const source = new DataSource({
    type: 'mysql',
    host,
    port,
    username: user,
    password,
    database,
    migrations: [
      path.join(__dirname, '../src/platform/database/migrations/[0-9]*.ts'),
    ],
    entities: [path.join(__dirname, '../src/**/*.entity.ts')],
    synchronize: false,
    logging: false,
  });
  try {
    await source.initialize();
    const applied = await source.runMigrations({ transaction: 'each' });
    if (applied.length < 30) {
      throw new Error(`Seulement ${applied.length} migrations appliquées`);
    }
    const pending = await source.showMigrations();
    if (pending) throw new Error('Des migrations restent en attente');
    await verifyCriticalIndexes(source);
    await verifyCriticalQueryPlans(source);
    await verifyNamedLocks();
    await verifyGameSessionInvariants(source);
    await verifyConcurrentUniqueness(source);
    await verifyRecentMigrationsWithExistingData(source);
    console.log(
      `mysql-migrations-integration: OK (${applied.length} migrations, plans SQL, historique, unicité et transactions vérifiés)`,
    );
  } finally {
    if (source.isInitialized) await source.destroy();
    await admin.query(`DROP DATABASE \`${database}\``);
    await admin.end();
  }
}

async function verifyNamedLocks() {
  const options = { host, port, user, password, database };
  const first = await mysql.createConnection(options);
  const second = await mysql.createConnection(options);
  const lockName = `lmdl:integration-lock:${process.pid}`;
  try {
    const [[initial]] = await first.query(
      'SELECT GET_LOCK(?, 0) AS acquired',
      [lockName],
    );
    const [[contended]] = await second.query(
      'SELECT GET_LOCK(?, 0) AS acquired',
      [lockName],
    );
    if (Number(initial.acquired) !== 1 || Number(contended.acquired) !== 0) {
      throw new Error('Exclusion du verrou nommé MySQL non garantie');
    }
    await first.query('SELECT RELEASE_LOCK(?) AS released', [lockName]);
    const [[afterRelease]] = await second.query(
      'SELECT GET_LOCK(?, 0) AS acquired',
      [lockName],
    );
    if (Number(afterRelease.acquired) !== 1) {
      throw new Error('Verrou nommé MySQL non libéré entre instances');
    }
    await second.query('SELECT RELEASE_LOCK(?) AS released', [lockName]);
  } finally {
    await Promise.allSettled([first.end(), second.end()]);
  }
}

const CRITICAL_INDEXES = [
  ['messaging_private_messages', 'idx_messaging_private_messages_sender_created'],
  [
    'messaging_private_messages',
    'idx_messaging_private_messages_recipient_created',
  ],
  [
    'social_relationships',
    'idx_social_relationship_requester_status_updated',
  ],
  [
    'social_relationships',
    'idx_social_relationship_addressee_status_updated',
  ],
  ['room_participants', 'idx_room_participants_room_active_joined'],
  ['room_participants', 'idx_room_participants_user_active'],
  ['rooms', 'idx_rooms_lobby_status_privacy_created'],
  ['game_matches', 'idx_game_matches_room_ended'],
  ['game_matches', 'idx_game_matches_type_ended'],
  ['bug_report_comments', 'idx_bug_report_comments_report_created'],
  [
    'notification_inbox_items',
    'idx_notification_inbox_user_deleted_created',
  ],
];

async function verifyCriticalIndexes(source) {
  const rows = await source.query(
    'SELECT TABLE_NAME AS tableName, INDEX_NAME AS indexName FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ?',
    [database],
  );
  const actual = new Set(rows.map((row) => `${row.tableName}:${row.indexName}`));
  for (const [table, index] of CRITICAL_INDEXES) {
    if (!actual.has(`${table}:${index}`)) {
      throw new Error(`Index critique absent: ${table}.${index}`);
    }
  }
}

const CRITICAL_QUERY_PLANS = [
  {
    index: 'idx_messaging_private_messages_recipient_created',
    sql: 'SELECT id FROM messaging_private_messages WHERE recipient_id = 1 ORDER BY created_at DESC LIMIT 50',
  },
  {
    index: 'idx_social_relationship_requester_status_updated',
    sql: "SELECT id FROM social_relationships WHERE requester_id = 1 AND status = 'pending' ORDER BY updated_at DESC LIMIT 50",
  },
  {
    index: 'idx_room_participants_room_active_joined',
    sql: 'SELECT id FROM room_participants WHERE room_id = 1 AND left_at IS NULL ORDER BY joined_at ASC LIMIT 100',
  },
  {
    index: 'idx_rooms_lobby_status_privacy_created',
    sql: "SELECT id FROM rooms WHERE status = 'lobby' AND is_private = 0 ORDER BY created_at DESC LIMIT 100",
  },
  {
    index: 'idx_game_matches_type_ended',
    sql: "SELECT id FROM game_matches WHERE game_type = 'integration-test' ORDER BY ended_at DESC LIMIT 100",
  },
  {
    index: 'idx_bug_report_comments_report_created',
    sql: 'SELECT id FROM bug_report_comments WHERE report_id = 1 ORDER BY created_at ASC LIMIT 100',
  },
  {
    index: 'idx_notification_inbox_user_deleted_created',
    sql: 'SELECT id FROM notification_inbox_items WHERE user_id = 1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 100',
  },
];

async function verifyCriticalQueryPlans(source) {
  for (const query of CRITICAL_QUERY_PLANS) {
    const rows = await source.query(`EXPLAIN ${query.sql}`);
    const possible = String(rows[0]?.possible_keys ?? '').split(',');
    if (!possible.includes(query.index)) {
      throw new Error(`Plan SQL sans index attendu: ${query.index}`);
    }
  }
}

async function verifyGameSessionInvariants(source) {
  const state = JSON.stringify({
    version: 1,
    status: 'started',
    phase: 'playing',
    log: [],
  });
  await source.query(
    'INSERT INTO game_sessions (room_id, game_type, version, state) VALUES (?, ?, ?, ?)',
    [99, 'integration-test', 1, state],
  );
  const attempts = await Promise.all([
    source.query(
      'UPDATE game_sessions SET version = version + 1 WHERE room_id = ? AND game_type = ? AND version = ?',
      [99, 'integration-test', 1],
    ),
    source.query(
      'UPDATE game_sessions SET version = version + 1 WHERE room_id = ? AND game_type = ? AND version = ?',
      [99, 'integration-test', 1],
    ),
  ]);
  const committed = attempts.filter((result) => result.affectedRows === 1);
  if (committed.length !== 1) {
    throw new Error(`CAS concurrent invalide: ${committed.length} commits`);
  }

  const runner = source.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    await runner.query(
      'INSERT INTO game_session_events (room_id, game_type, seq, version, event) VALUES (?, ?, ?, ?, ?)',
      [
        99,
        'integration-test',
        1,
        2,
        JSON.stringify({ seq: 1, version: 2, type: 'integration' }),
      ],
    );
    await runner.query(
      'UPDATE game_sessions SET version = 3 WHERE room_id = ? AND game_type = ?',
      [99, 'integration-test'],
    );
    await runner.rollbackTransaction();
  } finally {
    await runner.release();
  }
  const sessions = await source.query(
    'SELECT version FROM game_sessions WHERE room_id = ? AND game_type = ?',
    [99, 'integration-test'],
  );
  const events = await source.query(
    'SELECT COUNT(*) AS count FROM game_session_events WHERE room_id = ? AND game_type = ?',
    [99, 'integration-test'],
  );
  if (sessions[0]?.version !== 2 || Number(events[0]?.count) !== 0) {
    throw new Error('Rollback multi-table de session invalide');
  }
}

async function verifyConcurrentUniqueness(source) {
  const values = [
    101,
    'integration-unique',
    1,
    JSON.stringify({ version: 1, status: 'started', phase: 'playing', log: [] }),
  ];
  const results = await Promise.allSettled([
    source.query(
      'INSERT INTO game_sessions (room_id, game_type, version, state) VALUES (?, ?, ?, ?)',
      values,
    ),
    source.query(
      'INSERT INTO game_sessions (room_id, game_type, version, state) VALUES (?, ?, ?, ?)',
      values,
    ),
  ]);
  if (results.filter((result) => result.status === 'fulfilled').length !== 1) {
    throw new Error('Contrainte unique concurrente game_sessions non garantie');
  }
  const rejected = results.find((result) => result.status === 'rejected');
  const reason = rejected?.reason;
  if (reason?.code !== 'ER_DUP_ENTRY' && reason?.errno !== 1062) {
    throw new Error('Erreur unique MySQL non identifiable');
  }
}

async function verifyRecentMigrationsWithExistingData(source) {
  const before = await source.query(
    'SELECT COUNT(*) AS count FROM game_sessions WHERE room_id IN (99, 101)',
  );
  for (let index = 0; index < 5; index += 1) {
    await source.undoLastMigration({ transaction: 'each' });
  }
  const reapplied = await source.runMigrations({ transaction: 'each' });
  if (reapplied.length !== 5) {
    throw new Error(`Cycle historique incomplet: ${reapplied.length}/5 migrations`);
  }
  const after = await source.query(
    'SELECT COUNT(*) AS count FROM game_sessions WHERE room_id IN (99, 101)',
  );
  if (Number(before[0]?.count) !== Number(after[0]?.count)) {
    throw new Error('Données existantes perdues pendant le cycle de migrations');
  }
  await verifyCriticalIndexes(source);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
