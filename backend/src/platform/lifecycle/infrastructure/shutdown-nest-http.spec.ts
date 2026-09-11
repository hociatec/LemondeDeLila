import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { get, type Server } from 'node:http';
import { ApplicationShutdownService } from '../application/application-shutdown.service';
import { LifecycleModule } from '../module/lifecycle.module';
import { installGracefulShutdown } from './install-graceful-shutdown';

it('keeps Nest resources alive until an aborted HTTP request finishes its mutation', async () => {
  let accepted!: () => void, commit!: () => void;
  const started = new Promise<void>((resolve) => {
    accepted = resolve;
  });
  const mutation = new Promise<void>((resolve) => {
    commit = resolve;
  });
  const events: string[] = [];
  @Controller()
  class HeldController {
    @Get('mutate')
    async mutate() {
      accepted();
      await mutation;
      events.push('commit');
      return { ok: true };
    }
  }
  @Injectable()
  class Resource {
    onModuleDestroy() {
      events.push('module-destroy');
    }
    onApplicationShutdown() {
      events.push('application-shutdown');
    }
  }
  @Module({
    imports: [LifecycleModule],
    controllers: [HeldController],
    providers: [Resource],
  })
  class TestModule {}
  const app = await NestFactory.create(TestModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  const server = app.getHttpServer() as Server;
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Expected TCP address');
  const report = jest.fn();
  const previousSignalListeners = new Set(process.listeners('SIGTERM'));
  const close = installGracefulShutdown(
    app,
    app.get(ApplicationShutdownService),
    { closeConnections: async () => undefined },
    report,
  );
  const request = get(`http://127.0.0.1:${address.port}/mutate`);
  request.on('error', () => undefined);
  try {
    await started;
    request.destroy();
    const signal = process
      .listeners('SIGTERM')
      .find((listener) => !previousSignalListeners.has(listener));
    if (!signal) throw new Error('SIGTERM shutdown listener is missing');
    signal('SIGTERM');
    const closing = close();
    await Promise.resolve();
    expect(events).toEqual([]);
    commit();
    await closing;
    expect(events).toEqual([
      'commit',
      'module-destroy',
      'application-shutdown',
    ]);
    expect(report).not.toHaveBeenCalled();
    expect(process.listeners('SIGTERM')).toEqual([...previousSignalListeners]);
  } finally {
    commit();
    request.destroy();
    await close();
  }
});
