import { Test } from '@nestjs/testing';
import { stringifyExternalJson } from '../../../../../platform/serialization/public-api';
import { PayloadValidationService } from '../../../../../platform/validation/public-api';
import { SOCIAL_PROFILE_REPOSITORY } from '../../../application/ports/social-profile.repository';
import { SOCIAL_USER_READER } from '../../../application/ports/social-user.repository';
import { SOCIAL_RELATIONSHIP_REPOSITORY } from '../../../application/ports/social-relationship.repository';
import { SOCIAL_RELATIONSHIP_NOTIFIER } from '../../../application/ports/social-relationship-notifier.port';
import { SocialProfileService } from '../../../application/services/social-profile.service';
import { SocialProfileSettingsService } from '../../../application/services/social-profile-settings.service';
import { SocialRelationshipService } from '../../../application/services/social-relationship.service';
import { SocialWsHandler } from './social-ws.handler';

it('serializes stored dates for profile reads, edits and session preloading', async () => {
  const date = new Date('2026-09-16T18:00:00.000Z');
  const user = { id: 7, username: 'Alice', avatar: null };
  const friend = { id: 8, username: 'Bob', avatar: null };
  const profile = {
    userId: user.id,
    user,
    bio: 'Bonjour',
    victoryMessage: null,
    defeatMessage: null,
    visibility: 'public',
    createdAt: date,
    updatedAt: date,
  };
  const relation = {
    id: 1,
    requester: user,
    addressee: friend,
    status: 'accepted',
    createdAt: date,
    updatedAt: date,
  };
  const module = await Test.createTestingModule({
    providers: [
      SocialWsHandler,
      SocialProfileService,
      SocialRelationshipService,
      PayloadValidationService,
      {
        provide: SOCIAL_PROFILE_REPOSITORY,
        useValue: {
          findByUserId: jest.fn().mockResolvedValue(profile),
          save: jest.fn().mockResolvedValue(profile),
        },
      },
      { provide: SOCIAL_USER_READER, useValue: {} },
      {
        provide: SocialProfileSettingsService,
        useValue: {
          getFresh: jest
            .fn()
            .mockResolvedValue({ bioMinLength: 0, bioMaxLength: 20000 }),
        },
      },
      { provide: SOCIAL_RELATIONSHIP_NOTIFIER, useValue: {} },
      {
        provide: SOCIAL_RELATIONSHIP_REPOSITORY,
        useValue: {
          listAcceptedForUser: jest.fn().mockResolvedValue([relation]),
          listPendingForUser: jest
            .fn()
            .mockResolvedValue([{ ...relation, status: 'pending' }]),
          listBlockedByUser: jest
            .fn()
            .mockResolvedValue([{ ...relation, status: 'blocked' }]),
        },
      },
    ],
  }).compile();
  try {
    const handler = module.get(SocialWsHandler);
    const session = { connectionId: 'serialization-test', user };
    const read = await handler.getProfile(session, {});
    const frames = [
      read,
      await handler.updateProfile(session, { bio: 'Bonjour' }),
      await handler.listFriends(session),
      await handler.listBlocked(session),
      await handler.listRequests(session, { direction: 'incoming' }),
    ];
    for (const frame of frames) {
      expect(() => stringifyExternalJson(frame)).not.toThrow();
      expect(stringifyExternalJson(frame)).toContain(date.toISOString());
    }
    expect(read.payload.profile).toMatchObject({
      isOwner: true,
      canView: true,
      createdAt: date.toISOString(),
      updatedAt: date.toISOString(),
    });
    expect(profile.createdAt).toBeInstanceOf(Date);
  } finally {
    await module.close();
  }
});
