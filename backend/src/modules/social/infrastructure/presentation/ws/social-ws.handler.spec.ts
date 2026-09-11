import { Test } from '@nestjs/testing';
import { PayloadValidationService } from '../../../../../platform/validation/public-api';
import type { WsSession } from '../../../../../platform/realtime/public-api';
import { SocialProfileService } from '../../../application/services/social-profile.service';
import { SocialRelationshipService } from '../../../application/services/social-relationship.service';
import { SocialWsHandler } from './social-ws.handler';

const session: WsSession = {
  connectionId: 'test',
  user: { id: 7, username: 'Alice' },
};

async function fixture() {
  const profiles = { getProfile: jest.fn(), updateProfile: jest.fn() };
  const relationships = { requestFriend: jest.fn() };
  const module = await Test.createTestingModule({
    providers: [
      SocialWsHandler,
      PayloadValidationService,
      { provide: SocialProfileService, useValue: profiles },
      { provide: SocialRelationshipService, useValue: relationships },
    ],
  }).compile();
  return { handler: module.get(SocialWsHandler), profiles, relationships };
}

it('keeps the viewer and relationship actor distinct from the supplied target', async () => {
  const { handler, profiles, relationships } = await fixture();
  await handler.getProfile(session, { userId: 42 });
  expect(profiles.getProfile).toHaveBeenCalledWith(7, 42);
  await handler.getProfile(session, {});
  expect(profiles.getProfile).toHaveBeenLastCalledWith(7, 7);
  await handler.requestFriend(session, { userId: 42 });
  expect(relationships.requestFriend).toHaveBeenCalledWith(7, 42);
});

it('rejects an injected profile owner and anonymous writes', async () => {
  const { handler, profiles, relationships } = await fixture();
  await expect(
    handler.updateProfile(session, { userId: 42, bio: 'Injected' }),
  ).rejects.toThrow();
  await expect(
    handler.requestFriend({ ...session, user: null }, { userId: 42 }),
  ).rejects.toThrow();
  expect(profiles.updateProfile).not.toHaveBeenCalled();
  expect(relationships.requestFriend).not.toHaveBeenCalled();
});
