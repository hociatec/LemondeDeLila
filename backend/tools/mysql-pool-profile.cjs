#!/usr/bin/env node
'use strict';
/* eslint-disable no-console */

const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const mysql = require('mysql2/promise');

const connectionLimit = 2;
const concurrency = 16;

function percentile(values, ratio) {
  const ordered = [...values].sort((left, right) => left - right);
  return Number(
    ordered[Math.max(0, Math.ceil(ordered.length * ratio) - 1)].toFixed(3),
  );
}

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'le_monde_de_lila',
    connectionLimit,
    waitForConnections: true,
    queueLimit: 0,
  });
  let enqueued = 0;
  let active = 0;
  let peakActive = 0;
  pool.on('enqueue', () => {
    enqueued += 1;
  });
  const waits = [];
  try {
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        const startedAt = performance.now();
        const connection = await pool.getConnection();
        waits.push(performance.now() - startedAt);
        active += 1;
        peakActive = Math.max(peakActive, active);
        try {
          await connection.query('SELECT SLEEP(0.02)');
        } finally {
          active -= 1;
          connection.release();
        }
      }),
    );
  } finally {
    await pool.end();
  }
  const report = {
    schemaVersion: 1,
    connectionLimit,
    concurrency,
    peakActive,
    enqueued,
    saturated: peakActive === connectionLimit && enqueued > 0,
    acquisitionWaitMs: {
      p50: percentile(waits, 0.5),
      p95: percentile(waits, 0.95),
      p99: percentile(waits, 0.99),
      maximum: Number(Math.max(...waits).toFixed(3)),
    },
  };
  if (!report.saturated) throw new Error('MySQL pool did not saturate');
  const output = process.env.MYSQL_POOL_PROFILE_PATH;
  if (output) {
    const target = path.resolve(output);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
