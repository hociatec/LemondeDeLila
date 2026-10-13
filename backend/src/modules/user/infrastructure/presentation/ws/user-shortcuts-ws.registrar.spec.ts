import { UnauthorizedException } from '@nestjs/common';
import { UserShortcutsWsRegistrar } from './user-shortcuts-ws.registrar';
import { UserShortcutsService } from '../../../application/use-cases/user-shortcuts.service';
import {
  WS_EVENTS,
  WsRouteRegistry,
} from '../../../../../platform/realtime/public-api';

it('scopes reads and writes to the authenticated account, never a supplied user ID', async () => {
  const registry = new WsRouteRegistry();
  const repository = {
    get: jest.fn().mockResolvedValue({ revision: 0, items: [] }),
    replace: jest.fn().mockResolvedValue(true),
  };
  new UserShortcutsWsRegistrar(
    registry,
    new UserShortcutsService(repository),
  ).onModuleInit();
  const session = {
    user: { id: 7, username: 'Player', roles: ['ROLE_USER'] },
    connectionId: 'test',
  };
  const read = registry.get(WS_EVENTS.users.shortcutsGet);
  const write = registry.get(WS_EVENTS.users.shortcutsSet);
  if (!read || !write) throw new Error('Shortcut routes were not registered');
  expect(await read(session, { userId: 99 })).toEqual({
    type: WS_EVENTS.users.shortcutsGet,
    payload: { revision: 0, items: [] },
  });
  expect(repository.get).toHaveBeenCalledWith(7);
  await write(session, { userId: 99, revision: 0, items: [] });
  expect(repository.replace).toHaveBeenCalledWith(7, 0, []);
  await expect(
    read({ user: null, connectionId: 'anonymous' }, {}),
  ).rejects.toBeInstanceOf(UnauthorizedException);
  await expect(
    write(
      { user: null, connectionId: 'anonymous' },
      { revision: 0, items: [] },
    ),
  ).rejects.toBeInstanceOf(UnauthorizedException);
  expect(repository.replace).toHaveBeenCalledTimes(1);
});
