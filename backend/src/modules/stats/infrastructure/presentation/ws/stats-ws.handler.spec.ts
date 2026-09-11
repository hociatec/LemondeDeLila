import { Test } from '@nestjs/testing';
import { PayloadValidationService } from '../../../../../platform/validation/public-api';
import type { WsSession } from '../../../../../platform/realtime/public-api';
import { SocialProfileService } from '../../../../social/public-api';
import { GameStatsService } from '../../../application/services/game-stats.service';
import { StatsWsHandler } from './stats-ws.handler';

const session: WsSession = {
  connectionId: 'test',
  user: { id: 7, username: 'Alice' },
};

async function fixture() {
  const stats = { getMyStats: jest.fn().mockResolvedValue([]) };
  const profiles = {
    getProfile: jest.fn().mockResolvedValue({ isOwner: false, canView: false }),
  };
  const module = await Test.createTestingModule({
    providers: [
      StatsWsHandler,
      PayloadValidationService,
      { provide: GameStatsService, useValue: stats },
      { provide: SocialProfileService, useValue: profiles },
    ],
  }).compile();
  return { handler: module.get(StatsWsHandler), stats, profiles };
}

it('checks target visibility as the authenticated viewer before reading stats', async () => {
  const { handler, stats, profiles } = await fixture();
  await expect(handler.user(session, { userId: 42 })).rejects.toMatchObject({
    status: 403,
  });
  expect(profiles.getProfile).toHaveBeenCalledWith(7, 42);
  expect(stats.getMyStats).not.toHaveBeenCalled();
  profiles.getProfile.mockResolvedValue({ isOwner: false, canView: true });
  await handler.user(session, { userId: 42 });
  expect(stats.getMyStats).toHaveBeenCalledWith(42);
});

it('rejects anonymous access before consulting either service', async () => {
  const { handler, stats, profiles } = await fixture();
  await expect(
    handler.user({ ...session, user: null }, { userId: 42 }),
  ).rejects.toThrow();
  await expect(handler.my({ ...session, user: null })).rejects.toThrow();
  expect(profiles.getProfile).not.toHaveBeenCalled();
  expect(stats.getMyStats).not.toHaveBeenCalled();
});

it('reads own statistics with the session identity', async () => {
  const { handler, stats } = await fixture();
  await handler.my(session);
  expect(stats.getMyStats).toHaveBeenCalledWith(7);
});

it('accepts the administrator bypass only from authenticated roles', async () => {
  const { handler, stats, profiles } = await fixture();
  await expect(
    handler.user(session, { userId: 42, roles: ['admin'] }),
  ).rejects.toThrow();
  expect(stats.getMyStats).not.toHaveBeenCalled();
  await handler.user(
    { ...session, user: { id: 7, username: 'Alice', roles: ['ROLE_ADMIN'] } },
    { userId: 42 },
  );
  expect(profiles.getProfile).not.toHaveBeenCalled();
  expect(stats.getMyStats).toHaveBeenCalledWith(42);
});
