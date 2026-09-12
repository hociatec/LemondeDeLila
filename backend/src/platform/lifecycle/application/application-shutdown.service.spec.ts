import { ServiceUnavailableException } from '@nestjs/common';
import { ApplicationShutdownService } from './application-shutdown.service';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

it('rejects new work while preserving accepted mutations and cleanup', async () => {
  const shutdown = new ApplicationShutdownService();
  const mutation = deferred(),
    cleanup = deferred();
  const events: string[] = [];
  const command = shutdown.run(async () => {
    await mutation.promise;
    events.push('committed');
    void shutdown.run(
      () =>
        cleanup.promise.then(() => {
          events.push('cleaned');
        }),
      true,
    );
  });
  shutdown.stopAccepting();
  const forbidden = jest.fn();
  await expect(shutdown.run(forbidden)).rejects.toBeInstanceOf(
    ServiceUnavailableException,
  );
  expect(forbidden).not.toHaveBeenCalled();
  const drained = shutdown.drain().then(() => {
    events.push('drained');
  });
  mutation.resolve();
  await command;
  expect(events).toEqual(['committed']);
  cleanup.resolve();
  await drained;
  expect(events).toEqual(['committed', 'cleaned', 'drained']);
});

it('stops each source once and waits for active background work', async () => {
  const shutdown = new ApplicationShutdownService();
  const activeJob = deferred();
  const stopWorker = jest.fn(() => activeJob.promise);
  shutdown.registerSource('worker', stopWorker);
  const first = shutdown.stopSources();
  expect(shutdown.stopSources()).toBe(first);
  await Promise.resolve();
  expect(stopWorker).toHaveBeenCalledTimes(1);
  expect(shutdown.isDraining).toBe(true);
  expect(() => shutdown.registerSource('late', () => undefined)).toThrow();
  activeJob.resolve();
  await first;
});

it('does not hang on rejected commands and isolates application instances', async () => {
  const first = new ApplicationShutdownService(),
    second = new ApplicationShutdownService();
  await expect(
    first.run(() => {
      throw new Error('failed mutation');
    }),
  ).rejects.toThrow('failed mutation');
  await first.stopSources();
  await first.drain();
  await expect(second.run(() => 42)).resolves.toBe(42);
});

it('does not hide a failure to stop a source', async () => {
  const shutdown = new ApplicationShutdownService();
  shutdown.registerSource('worker', () => {
    throw new Error('worker did not stop');
  });
  await expect(shutdown.stopSources()).rejects.toThrow('worker did not stop');
});

it('rejects normalized duplicate sources without replacing their cleanup', async () => {
  const shutdown = new ApplicationShutdownService();
  const stop = jest.fn();
  shutdown.registerSource('worker', stop);
  expect(() => shutdown.registerSource(' worker ', () => undefined)).toThrow();
  await shutdown.stopSources();
  expect(stop).toHaveBeenCalledTimes(1);
});

it('waits for every source and reports all failures', async () => {
  const shutdown = new ApplicationShutdownService();
  const worker = deferred();
  const firstError = new Error('first source');
  const secondError = new Error('second source');
  shutdown.registerSource('first', () => {
    throw firstError;
  });
  shutdown.registerSource('worker', async () => {
    await worker.promise;
    throw secondError;
  });
  let settled = false;
  const stopping = shutdown.stopSources().catch((error: unknown) => {
    settled = true;
    return error;
  });
  await Promise.resolve();
  await Promise.resolve();
  expect(settled).toBe(false);
  worker.resolve();
  const error = await stopping;
  expect(error).toBeInstanceOf(AggregateError);
  if (!(error instanceof AggregateError)) throw new Error('Expected failures');
  expect(error.errors).toEqual([firstError, secondError]);
});
