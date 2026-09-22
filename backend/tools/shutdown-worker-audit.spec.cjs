const assert = require('node:assert/strict');
const test = require('node:test');
const { inspect } = require('./shutdown-worker-audit.cjs');

for (const [declaration, name] of [
  ["import { Worker } from 'bullmq';", 'Worker'],
  ["import { Worker as QueueWorker } from 'bullmq';", 'QueueWorker'],
  ["import * as jobs from 'bullmq';", 'jobs.Worker'],
]) {
  test(`requires tracked admission for ${name}`, () => {
    const source = (body) => `${declaration} class Owner { start() {
      this.shutdown.registerSource('worker', () => this.worker.close());
      this.worker = new ${name}('queue', ${body});
    } }`;
    assert.deepEqual(inspect(source('(job) => this.shutdown.run(() => process(job))')), []);
    assert.equal(inspect(source('(job) => process(job)')).length, 1);
    assert.equal(inspect(source('(job) => this.shutdown.run(() => process(job), true)')).length, 1);
    assert.equal(inspect(source('(job) => { mutate(job); return this.shutdown.run(() => process(job)); }')).length, 1);
  });
}
test('requires stopping the source before draining', () => {
  assert.equal(inspect("import { Worker } from 'bullmq'; new Worker('q', job => this.shutdown.run(() => process(job)))").length, 1);
});
