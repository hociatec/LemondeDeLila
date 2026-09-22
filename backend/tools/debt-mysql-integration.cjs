'use strict';
// Uses an explicitly selected test server and an exclusively owned database.
require('ts-node').register({ transpileOnly: true });
require('tsconfig-paths/register');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const mysql = require('mysql2/promise');
const { DataSource } = require('typeorm');
const { AddAdminMaintenanceLocks1790035200000 } = require('../src/platform/database/migrations/1790035200000-AddAdminMaintenanceLocks');
const { IndexRecoverableGameSessions1790035300000 } = require('../src/platform/database/migrations/1790035300000-IndexRecoverableGameSessions');
const { MysqlAdminMaintenanceLockService } = require('../src/modules/admin/infrastructure/persistence/typeorm/mysql-admin-maintenance-lock.service');
const { MysqlGameActiveSessionsReader } = require('../src/game/core/infrastructure/persistence/typeorm/mysql-game-active-sessions.reader');
const { GameSessionEntity } = require('../src/game/core/infrastructure/persistence/typeorm/entities/game-session.entity');

async function main() {
  const port = Number(process.env.DEBT_TEST_MYSQL_PORT);
  assert(Number.isInteger(port) && port > 0, 'Set DEBT_TEST_MYSQL_PORT to an isolated test server');
  const database = `lila_debt_test_${randomUUID().replaceAll('-', '')}`;
  const connection = { host: '127.0.0.1', port, user: 'root', password: process.env.DEBT_TEST_MYSQL_PASSWORD ?? '' };
  const admin = await mysql.createConnection(connection);
  const sources = [];
  try {
    await admin.query(`CREATE DATABASE ${database}`);
    for (let i = 0; i < 2; i++) {
      const source = new DataSource({ ...connection, username: connection.user, database, type: 'mysql', entities: [GameSessionEntity], synchronize: false });
      await source.initialize();
      sources.push(source);
    }
    const [first, second] = sources;
    const runner = first.createQueryRunner();
    const maintenance = new AddAdminMaintenanceLocks1790035200000();
    const recovery = new IndexRecoverableGameSessions1790035300000();
    try {
      await maintenance.up(runner);
      const local = { runExclusive: async (_operation, run) => run() };
      const a = new MysqlAdminMaintenanceLockService(first, local);
      const b = new MysqlAdminMaintenanceLockService(second, local);
      let finish;
      let entered;
      const started = new Promise((resolve) => { entered = resolve; });
      const active = a.runExclusive('migrations', () => {
        entered();
        return new Promise((resolve) => { finish = resolve; });
      });
      await started;
      try {
        // An independent connection/host cannot acquire while an owner is paused.
        await assert.rejects(b.runExclusive('deploy', () => assert.fail('overlap')), /maintenance/);
        await assert.rejects(maintenance.down(runner), /owner exists/);
        await second.query('DELETE FROM admin_maintenance_locks WHERE lock_name = ? AND owner_token = ?', ['global', randomUUID()]);
        assert.equal((await second.query('SELECT * FROM admin_maintenance_locks')).length, 1);
      } finally {
        finish();
        await active;
      }
      assert.equal(await b.runExclusive('deploy', () => 'completed'), 'completed');
      await assert.rejects(a.runExclusive('build', () => { throw new Error('failed build'); }), /failed build/);
      assert.equal((await first.query('SELECT * FROM admin_maintenance_locks')).length, 0);
      await maintenance.down(runner);
      await maintenance.up(runner);

      // A separate maintenance process retains the row after the HTTP scope ends.
      const directory = await mkdtemp(path.join(tmpdir(), 'lila-maintenance-test-'));
      const marker = path.join(directory, 'started');
      const token = randomUUID();
      await first.query('INSERT INTO admin_maintenance_locks (lock_name, owner_token, operation) VALUES (?, ?, ?)', ['global', token, 'test-child']);
      const child = spawn(process.execPath, ['-r', 'ts-node/register', path.resolve('src/modules/admin/infrastructure/system/admin-maintenance-child.ts'), JSON.stringify({
        token, delayMs: 0, argv: [process.execPath, '-e', `require('node:fs').writeFileSync(process.argv[1], 'started'); setTimeout(() => {}, 2000)`, marker],
      })], { windowsHide: true, stdio: 'ignore', env: { ...process.env, DATABASE_URL: '', DB_HOST: connection.host, DB_PORT: String(port), DB_USER: connection.user, DB_PASSWORD: connection.password, DB_NAME: database } });
      const completed = new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', resolve);
      });
      try {
        let started = false;
        for (let attempt = 0; attempt < 300; attempt++) {
          started = await readFile(marker, 'utf8').then(() => true, () => false);
          if (started || child.exitCode !== null) break;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        assert(started, 'Maintenance child must execute the harmless command');
        await assert.rejects(b.runExclusive('deploy', () => assert.fail('detached overlap')), /maintenance/);
        assert.equal(await completed, 0);
        assert.equal((await first.query('SELECT * FROM admin_maintenance_locks')).length, 0);
        assert.equal(await b.runExclusive('deploy', () => 'after-child'), 'after-child');
      } finally {
        // Only the unique directory created above and its known marker are removed.
        await completed;
        await rm(marker, { force: true });
        await require('node:fs/promises').rmdir(directory);
      }

      await runner.query(`CREATE TABLE game_sessions (
        room_id INT UNSIGNED NOT NULL, game_type VARCHAR(120) NOT NULL,
        version INT UNSIGNED NOT NULL, state JSON NOT NULL,
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (room_id, game_type)
      ) ENGINE=InnoDB`);
      await recovery.up(runner);
      for (let offset = 0; offset < 5201; offset += 500) {
        const values = Array.from({ length: Math.min(500, 5201 - offset) }, (_, i) => [
          offset + i + 1, 'example', 1, JSON.stringify({ status: offset + i < 5000 ? 'finished' : 'playing' }),
        ]);
        await admin.query(`INSERT INTO ${database}.game_sessions (room_id, game_type, version, state) VALUES ?`, [values]);
      }
      await runner.query('ANALYZE TABLE game_sessions');
      const reader = new MysqlGameActiveSessionsReader(first.getRepository(GameSessionEntity));
      const keys = [];
      let cursor = null;
      for (;;) {
        const page = await reader.listAfter(cursor, 100);
        if (!page.length) break;
        keys.push(...page);
        cursor = page.at(-1);
      }
      assert.deepEqual(keys.map((key) => key.roomId), Array.from({ length: 201 }, (_, i) => i + 5001));
      const plan = await runner.query('EXPLAIN SELECT room_id, game_type FROM game_sessions WHERE recovery_pending = 1 ORDER BY room_id, game_type LIMIT 100');
      assert.equal(plan[0].key, 'idx_game_sessions_recovery');
      assert.match(plan[0].Extra, /Using index/);
      await runner.query('UPDATE game_sessions SET state = ? WHERE room_id = 5001', [JSON.stringify({ status: 'finished' })]);
      assert.equal((await reader.listAfter(null, 100))[0].roomId, 5002);
      await runner.query('UPDATE game_sessions SET state = ? WHERE room_id = 1', [JSON.stringify({ status: 'playing' })]);
      assert.equal((await reader.listAfter(null, 100))[0].roomId, 1);
      await recovery.down(runner);
      await recovery.up(runner);
      assert.equal((await reader.listAfter(null, 100))[0].roomId, 1);
      console.log(JSON.stringify({ maintenance: 'cross-connection exclusion, token ownership, failure cleanup, rollback guard, detached child completion', recovery: '5201 rows, 201 recoverable, indexed keyset scan, automatic index updates, up/down/up', index: plan[0].key }));
    } finally {
      await runner.release();
    }
  } finally {
    await Promise.all(sources.map((source) => source.destroy()));
    assert(/^lila_debt_test_[a-f0-9]{32}$/.test(database));
    await admin.query(`DROP DATABASE IF EXISTS ${database}`);
    await admin.end();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
