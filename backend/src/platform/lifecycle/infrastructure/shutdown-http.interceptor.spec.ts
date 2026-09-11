import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { from } from 'rxjs';
import { ApplicationShutdownService } from '../application/application-shutdown.service';
import { ShutdownHttpInterceptor } from './shutdown-http.interceptor';

it('waits for the HTTP mutation even if the response subscription disappears', async () => {
  const shutdown = new ApplicationShutdownService();
  let commit!: () => void;
  const mutation = new Promise<void>((resolve) => {
    commit = resolve;
  });
  const handler: CallHandler = { handle: () => from(mutation) };
  const context = { getType: () => 'http' } as ExecutionContext;
  const subscription = new ShutdownHttpInterceptor(shutdown)
    .intercept(context, handler)
    .subscribe();
  subscription.unsubscribe();
  shutdown.stopAccepting();
  let drained = false;
  const completion = shutdown.drain().then(() => {
    drained = true;
  });
  await Promise.resolve();
  expect(drained).toBe(false);
  commit();
  await completion;
  expect(drained).toBe(true);
});
