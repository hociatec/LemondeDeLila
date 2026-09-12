import { UnauthorizedException } from '@nestjs/common';
import { PayloadValidationService } from '../../../../../platform/validation/public-api';
import type { WsSession } from '../../../../../platform/realtime/public-api';
import { AdminPerfWsHandler } from './admin-perf-ws.handler';

const sessions: WsSession[] = [
  { connectionId: 'anonymous', user: null },
  {
    connectionId: 'player',
    user: { id: 1, username: 'player', roles: ['ROLE_USER'] },
  },
];

it.each(sessions)(
  'denies diagnostic snapshots to $connectionId before reading data',
  (session) => {
    const snapshot = jest.fn();
    const handler = new AdminPerfWsHandler(new PayloadValidationService(), {
      snapshot,
    });
    expect(() =>
      handler.perfSnapshot(session, { roles: ['ROLE_ADMIN'], userId: 2 }),
    ).toThrow(UnauthorizedException);
    expect(snapshot).not.toHaveBeenCalled();
  },
);

it('allows an administrator authenticated by the server to read diagnostics', () => {
  const snapshot = jest.fn().mockReturnValue({ events: [] });
  const handler = new AdminPerfWsHandler(new PayloadValidationService(), {
    snapshot,
  });
  expect(
    handler.perfSnapshot(
      {
        connectionId: 'admin',
        user: { id: 2, username: 'admin', roles: ['ROLE_ADMIN'] },
      },
      { windowSeconds: 60 },
    ),
  ).toEqual({ type: 'admin.perf.snapshot', payload: { events: [] } });
  expect(snapshot).toHaveBeenCalledWith({ windowSeconds: 60 });
});
