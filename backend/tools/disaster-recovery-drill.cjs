#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const mysql = require('mysql2/promise');
const Redis = require('ioredis');

const compose = path.join(__dirname, 'real-integration.compose.yml');
const database = process.env.DB_NAME || 'lmdl_integration';
const restoredDatabase = `lmdl_restore_drill_${process.pid}_${Date.now()}`;
const startedAt = Date.now();
const backupKey =
  process.env.DRILL_BACKUP_KEY || crypto.randomBytes(32).toString('hex');

function dockerCompose(args, input) {
  const result = spawnSync('docker', ['compose', '-f', compose, ...args], {
    cwd: path.resolve(__dirname, '..'),
    input,
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      result.stderr.toString('utf8') ||
        `docker compose ${args.join(' ')} a échoué`,
    );
  }
  return result.stdout;
}

function encrypt(value) {
  const salt = crypto.randomBytes(16);
  const nonce = crypto.randomBytes(12);
  const key = crypto.scryptSync(backupKey, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  const encrypted = Buffer.concat([cipher.update(value), cipher.final()]);
  return Buffer.concat([salt, nonce, cipher.getAuthTag(), encrypted]);
}

function decrypt(value) {
  const salt = value.subarray(0, 16);
  const nonce = value.subarray(16, 28);
  const tag = value.subarray(28, 44);
  const key = crypto.scryptSync(backupKey, salt, 32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(value.subarray(44)), decipher.final()]);
}

async function drillMysql() {
  const dump = dockerCompose([
    'exec',
    '-T',
    'mysql',
    'mysqldump',
    '-uroot',
    '-pintegration',
    '--single-transaction',
    '--routines',
    '--triggers',
    database,
  ]);
  const encrypted = encrypt(dump);
  const admin = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 33306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'integration',
  });
  try {
    await admin.query(
      `CREATE DATABASE \`${restoredDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    dockerCompose(
      [
        'exec',
        '-T',
        'mysql',
        'mysql',
        '-uroot',
        '-pintegration',
        restoredDatabase,
      ],
      decrypt(encrypted),
    );
    const [[source]] = await admin.query(
      'SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
      [database],
    );
    const [[restored]] = await admin.query(
      'SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
      [restoredDatabase],
    );
    if (
      Number(source.count) === 0 ||
      Number(source.count) !== Number(restored.count)
    ) {
      throw new Error(
        `Restauration MySQL incomplète: ${source.count} tables source, ${restored.count} restaurées`,
      );
    }
    return { tables: Number(restored.count), encryptedBytes: encrypted.length };
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS \`${restoredDatabase}\``);
    await admin.end();
  }
}

async function drillRedis() {
  const url = process.env.SESSION_STORE_REDIS_URL || 'redis://127.0.0.1:36379';
  const redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
  const sourceKey = `lila:drill:source:${process.pid}`;
  const restoredKey = `lila:drill:restored:${process.pid}`;
  try {
    await redis.connect();
    const expected = JSON.stringify({
      marker: crypto.randomUUID(),
      at: new Date().toISOString(),
    });
    await redis.set(sourceKey, expected, 'EX', 300);
    const serialized = await redis.callBuffer('DUMP', sourceKey);
    if (!serialized) throw new Error('DUMP Redis vide');
    const encrypted = encrypt(serialized);
    await redis.restore(restoredKey, 300_000, decrypt(encrypted), 'REPLACE');
    const actual = await redis.get(restoredKey);
    if (actual !== expected)
      throw new Error('Valeur Redis restaurée différente');
    return { encryptedBytes: encrypted.length };
  } finally {
    await redis.del(sourceKey, restoredKey).catch(() => undefined);
    redis.disconnect();
  }
}

async function main() {
  const mysqlResult = await drillMysql();
  const redisResult = await drillRedis();
  const finishedAt = Date.now();
  const report = {
    schemaVersion: 1,
    executedAt: new Date(finishedAt).toISOString(),
    durationSeconds: Number(((finishedAt - startedAt) / 1000).toFixed(3)),
    rpoSeconds: 0,
    targets: { rpoSeconds: 900, rtoSeconds: 3600 },
    mysql: mysqlResult,
    redis: redisResult,
    encryption: 'AES-256-GCM/scrypt',
    status: 'passed',
  };
  if (report.durationSeconds > report.targets.rtoSeconds) {
    throw new Error(`RTO dépassé: ${report.durationSeconds}s`);
  }
  const reportPath = process.env.DRILL_REPORT_PATH;
  if (reportPath)
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    `disaster-recovery-drill: OK (${report.durationSeconds}s, ${mysqlResult.tables} tables MySQL, Redis restauré)`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
