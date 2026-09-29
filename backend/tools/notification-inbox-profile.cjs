#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

require('ts-node').register({ transpileOnly: true });
require('tsconfig-paths/register');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const dataSource = require('../src/data-source').default;
const {
  NotificationInboxItemEntity,
} = require('../src/modules/notification/infrastructure/persistence/typeorm/entities/notification-inbox-item.entity');
const {
  NotificationInboxTypeormRepository,
} = require('../src/modules/notification/infrastructure/persistence/typeorm/repositories/notification-inbox-typeorm.repository');

const CREATE_VOLUME = 2_000;
const UPDATE_VOLUME = 500;

function elapsedMs(start) {
  return Number(process.hrtime.bigint() - start) / 1_000_000;
}

async function main() {
  await dataSource.initialize();
  const suffix = randomUUID();
  let userId;
  try {
    const insert = await dataSource.query(
      'INSERT INTO users (email, roles, password, username) VALUES (?, ?, ?, ?)',
      [
        `notification-profile-${suffix}@example.test`,
        JSON.stringify(['user']),
        'not-a-real-password-hash',
        `notification-profile-${suffix}`,
      ],
    );
    userId = Number(insert.insertId);
    assert(userId > 0, 'Profile user was not created');

    const repository = new NotificationInboxTypeormRepository(
      dataSource.getRepository(NotificationInboxItemEntity),
      { now: () => Date.now() },
    );
    const createdAt = new Date();
    const items = Array.from({ length: CREATE_VOLUME }, (_, index) => ({
      id: randomUUID(),
      userId,
      kind: 'performance_profile',
      contactId: suffix,
      message: `profile-${index}`,
      payload: { sequence: index, status: 'created' },
      createdAt,
    }));

    const createStarted = process.hrtime.bigint();
    await repository.createMany(items);
    const createManyMs = elapsedMs(createStarted);
    const [{ count: createdCount }] = await dataSource.query(
      'SELECT COUNT(*) AS count FROM notification_inbox_items WHERE user_id = ?',
      [userId],
    );
    assert.equal(Number(createdCount), CREATE_VOLUME);

    const updates = items.slice(0, UPDATE_VOLUME).map((item, index) => ({
      id: item.id,
      payload: { sequence: index, status: 'batched' },
    }));
    const updateStarted = process.hrtime.bigint();
    const affected = await repository.updatePayloads(updates);
    const updatePayloadsMs = elapsedMs(updateStarted);
    assert.equal(affected, UPDATE_VOLUME);

    const individualStarted = process.hrtime.bigint();
    for (const [index, item] of items
      .slice(UPDATE_VOLUME, UPDATE_VOLUME * 2)
      .entries()) {
      await dataSource.query(
        'UPDATE notification_inbox_items SET payload = ? WHERE id = ?',
        [JSON.stringify({ sequence: index, status: 'individual' }), item.id],
      );
    }
    const individualUpdatesMs = elapsedMs(individualStarted);

    assert(createManyMs < 30_000, `createMany too slow: ${createManyMs}ms`);
    assert(
      updatePayloadsMs < 10_000,
      `updatePayloads too slow: ${updatePayloadsMs}ms`,
    );
    assert(
      updatePayloadsMs < individualUpdatesMs,
      `CASE batch (${updatePayloadsMs}ms) did not beat individual updates (${individualUpdatesMs}ms)`,
    );

    const report = {
      status: 'passed',
      createMany: {
        rows: CREATE_VOLUME,
        milliseconds: Number(createManyMs.toFixed(2)),
        rowsPerSecond: Number(
          ((CREATE_VOLUME * 1000) / createManyMs).toFixed(2),
        ),
      },
      updatePayloads: {
        rows: UPDATE_VOLUME,
        milliseconds: Number(updatePayloadsMs.toFixed(2)),
        rowsPerSecond: Number(
          ((UPDATE_VOLUME * 1000) / updatePayloadsMs).toFixed(2),
        ),
      },
      individualUpdateBaseline: {
        rows: UPDATE_VOLUME,
        milliseconds: Number(individualUpdatesMs.toFixed(2)),
      },
      decision: 'keep-case-batch',
    };
    const reportPath =
      process.env.NOTIFICATION_INBOX_PROFILE_PATH ||
      path.join(process.cwd(), 'logs/notification-inbox-profile.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`notification-inbox-profile: ${JSON.stringify(report)}`);
  } finally {
    if (userId) {
      await dataSource.query('DELETE FROM users WHERE id = ?', [userId]);
    }
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
