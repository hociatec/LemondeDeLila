import { MessagingContactPolicy } from './app-messaging-contact-policy.module';
import type { SocialRelationshipService } from '../../modules/social/public-api';

it.each([
  [false, false, true],
  [true, false, false],
  [false, true, false],
  [true, true, false],
])(
  'enforces both blocking directions (%s, %s)',
  async (isBlocked, blockedByTarget, expected) => {
    const relationships = {
      getRelationshipState: jest
        .fn()
        .mockResolvedValue({ isBlocked, blockedByTarget }),
    };
    const policy = new MessagingContactPolicy(
      relationships as unknown as SocialRelationshipService,
    );
    expect(await policy.canSend(1, 2)).toBe(expected);
    expect(relationships.getRelationshipState).toHaveBeenCalledWith(1, 2);
  },
);
