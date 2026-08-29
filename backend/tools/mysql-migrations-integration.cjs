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
    migrations: [path.join(__dirname, '../src/migrations/*.ts')],
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
    await verifyGameSessionInvariants(source);
    console.log(
      `mysql-migrations-integration: OK (${applied.length} migrations, index et transactions vérifiés)`,
    );
  } finally {
    if (source.isInitialized) await source.destroy();
    await admin.query(`DROP DATABASE \`${database}\``);
    await admin.end();
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

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
