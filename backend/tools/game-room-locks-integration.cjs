#!/usr/bin/env node
'use strict';
require('ts-node/register');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mysql = require('mysql2/promise');
const { DataSource } = require('typeorm');
const { MysqlGameRoomLockService } = require('../src/game/core/infrastructure/persistence/typeorm/mysql-game-room-lock.service');

const options = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  connectTimeout: 5000,
};

async function main() {
  const first = await mysql.createConnection(options);
  const second = await mysql.createConnection(options);
  const lockName = `lmdl:test:${crypto.randomUUID()}`;
  let destroyed = false;
  try {
    const acquire = async (connection, timeout = 0) => {
      const [[row]] = await connection.query('SELECT GET_LOCK(?, ?) AS acquired', [lockName, timeout]);
      return Number(row.acquired);
    };
    assert.equal(await acquire(first), 1);
    assert.equal(await acquire(second), 0);
    first.destroy(); destroyed = true;
    assert.equal(await acquire(second, 5), 1, 'The named lock must be released when its owning connection disappears');
    const [[release]] = await second.query('SELECT RELEASE_LOCK(?) AS released', [lockName]);
    assert.equal(Number(release.released), 1);
  } finally {
    if (!destroyed) await first.end();
    await second.end();
  }

  const source = new DataSource({
    type: 'mysql', host: options.host, port: options.port,
    username: options.user, password: options.password,
    database: process.env.DB_NAME || 'mysql', synchronize: false, entities: [],
    extra: { connectionLimit: 4, connectTimeout: 5000 },
  });
  await source.initialize();
  const service = new MysqlGameRoomLockService(source, { get: () => 0 });
  const roomId = crypto.randomInt(1000000000, 2000000000);
  try {
    await service.runExclusive(roomId, async () => {
      await assert.rejects(service.runExclusive(roomId, async () => assert.fail('contended operation ran')), { code: 'GAME_ROOM_LOCK_UNAVAILABLE' });
      assert.equal(await service.runExclusive(roomId + 1, async () => 'independent'), 'independent');
    });
    const failure = new Error('controlled operation failure');
    await assert.rejects(service.runExclusive(roomId, async () => { throw failure; }), error => error === failure);
    assert.equal(await service.runExclusive(roomId, async () => 'recovered'), 'recovered');
    const [available] = await source.query('SELECT IS_FREE_LOCK(?) AS available', [`lmdl:game-room:${roomId}`]);
    assert.equal(Number(available.available), 1);
  } finally {
    await source.destroy();
  }
  console.log('game-room-locks-integration: OK (real MySQL contention, independent rooms, owner connection loss, operation failure, release and reacquisition)');
}

main().catch(error => {
  console.error(`game-room-locks-integration: FAILED (${error.code || error.name}: ${error.message})`);
  process.exitCode = 1;
});
