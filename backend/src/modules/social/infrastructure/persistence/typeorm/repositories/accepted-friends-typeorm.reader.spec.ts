import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SocialRelationshipEntity } from '../entities/social-relationship.entity';
import { AcceptedFriendsTypeormReader } from './accepted-friends-typeorm.reader';

describe('AcceptedFriendsTypeormReader', () => {
  it('reads accepted relationships in either direction with a stable bound', async () => {
    const find = jest.fn().mockResolvedValue([
      { requester: { id: 42 }, addressee: { id: 7 } },
      { requester: { id: 9 }, addressee: { id: 42 } },
      { requester: { id: 42 }, addressee: { id: 42 } },
    ]);
    const module = await Test.createTestingModule({
      providers: [
        AcceptedFriendsTypeormReader,
        {
          provide: getRepositoryToken(SocialRelationshipEntity),
          useValue: { find },
        },
      ],
    }).compile();
    try {
      await expect(
        module.get(AcceptedFriendsTypeormReader).listAcceptedFriendIds(42),
      ).resolves.toEqual([7, 9]);
      expect(find).toHaveBeenCalledWith({
        where: [
          { requester: { id: 42 }, status: 'accepted' },
          { addressee: { id: 42 }, status: 'accepted' },
        ],
        take: 500,
        order: { id: 'ASC' },
      });
    } finally {
      await module.close();
    }
  });
});
