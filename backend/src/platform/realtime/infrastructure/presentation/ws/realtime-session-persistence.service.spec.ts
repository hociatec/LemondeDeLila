import type { SessionStateStore } from '../../../../session/public-api';
import { RealtimeSessionPersistenceService } from './realtime-session-persistence.service';

function fixture() {
  const store: jest.Mocked<SessionStateStore> = {
    save: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
  };
  return { store, service: new RealtimeSessionPersistenceService(store) };
}

it('persists only the session identity projection', async () => {
  const { service, store } = fixture();
  await service.persistSession({
    connectionId: 'connection',
    user: { id: 7, username: 'Alice', roles: ['ROLE_USER'] },
  });
  expect(store.save).toHaveBeenCalledWith('connection', {
    userId: 7,
    username: 'Alice',
    roles: ['ROLE_USER'],
  });
  await service.persistSession({ connectionId: 'anonymous', user: null });
  expect(store.save).toHaveBeenLastCalledWith('anonymous', {
    userId: null,
    username: undefined,
    roles: null,
  });
});

it('keeps disconnect cleanup pending until the storage operation settles', async () => {
  const { service, store } = fixture();
  let release!: () => void;
  store.delete.mockReturnValue(
    new Promise<void>((resolve) => {
      release = resolve;
    }),
  );
  let completed = false;
  const cleanup = service.clearSession('connection').then(() => {
    completed = true;
  });
  await Promise.resolve();
  expect(completed).toBe(false);
  expect(store.delete).toHaveBeenCalledWith('connection');
  release();
  await cleanup;
  expect(completed).toBe(true);
});
