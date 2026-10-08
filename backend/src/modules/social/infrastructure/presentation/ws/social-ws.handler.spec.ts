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
  const relationships = {
    listFriends: jest.fn().mockResolvedValue([{ id: 8, username: 'Bob' }]),
    listRequests: jest.fn().mockResolvedValue([]),
    listBlocked: jest.fn().mockResolvedValue([{ id: 9, username: 'Charles' }]),
    requestFriend: jest.fn(),
    getRelationshipState: jest.fn().mockResolvedValue({
      isFriend: true,
      isBlocked: false,
      blockedByTarget: false,
      outgoingRequest: false,
      incomingRequest: false,
    }),
  };
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
  await expect(
    handler.getRelationshipState(session, { userId: 42 }),
  ).resolves.toEqual({
    type: 'social.relationship.get',
    payload: {
      state: expect.objectContaining({ isFriend: true }),
    },
  });
  expect(relationships.getRelationshipState).toHaveBeenCalledWith(7, 42);
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

it.each(['friends', 'incoming', 'outgoing'])(
  'bundles blocked users with %s in one response and starts both reads together',
  async (section) => {
    const { handler, relationships } = await fixture();
    let resolveItems!: (items: never[]) => void;
    const primary =
      section === 'friends'
        ? relationships.listFriends
        : relationships.listRequests;
    primary.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveItems = resolve;
        }),
    );
    const pending =
      section === 'friends'
        ? handler.listFriends(session, { includeBlocked: true })
        : handler.listRequests(session, {
            direction: section,
            includeBlocked: true,
          });
    expect(primary).toHaveBeenCalledTimes(1);
    expect(relationships.listBlocked).toHaveBeenCalledWith(7);
    resolveItems([]);
    expect((await pending).payload).toEqual({
      items: [],
      blockedUsers: [{ id: 9, username: 'Charles' }],
    });
  },
);

it('keeps unbundled responses compatible and validates the new option', async () => {
  const { handler, relationships } = await fixture();
  expect((await handler.listFriends(session)).payload).toEqual({
    items: [{ id: 8, username: 'Bob' }],
  });
  expect((await handler.listRequests(session, {})).payload).toEqual({
    items: [],
  });
  expect(relationships.listBlocked).not.toHaveBeenCalled();
  await expect(
    handler.listFriends(session, { includeBlocked: 'true' }),
  ).rejects.toThrow();
  await expect(
    handler.listRequests(session, {
      includeBlocked: true,
      direction: 'invalid',
    }),
  ).rejects.toThrow();
  await expect(
    handler.listFriends({ ...session, user: null }, { includeBlocked: true }),
  ).rejects.toThrow();
});
