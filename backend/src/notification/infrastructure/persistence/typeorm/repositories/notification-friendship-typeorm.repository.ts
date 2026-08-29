import { Inject, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import type { NotificationFriendshipRepository } from '../../../../application/ports/notification-friendship.repository';

export const NOTIFICATION_SOCIAL_RELATIONSHIPS_TYPEORM_REPOSITORY = Symbol(
  'NOTIFICATION_SOCIAL_RELATIONSHIPS_TYPEORM_REPOSITORY',
);

type SocialRelationshipRow = {
  requester?: { id: number } | null;
  addressee?: { id: number } | null;
  status: string;
};

@Injectable()
export class NotificationFriendshipTypeormRepository implements NotificationFriendshipRepository {
  constructor(
    @Inject(NOTIFICATION_SOCIAL_RELATIONSHIPS_TYPEORM_REPOSITORY)
    private readonly relationships: Repository<SocialRelationshipRow>,
  ) {}

  async listAcceptedFriendIds(userId: number): Promise<number[]> {
    const relations = await this.relationships.find({
      where: [
        { requester: { id: userId }, status: 'accepted' },
        { addressee: { id: userId }, status: 'accepted' },
      ],
      take: 500,
    });

    return relations
      .map((relation) =>
        relation.requester?.id === userId
          ? relation.addressee?.id
          : relation.requester?.id,
      )
      .filter(
        (id): id is number => typeof id === 'number' && id > 0 && id !== userId,
      );
  }
}
