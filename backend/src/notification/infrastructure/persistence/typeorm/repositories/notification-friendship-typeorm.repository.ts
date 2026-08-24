import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { NotificationFriendshipRepository } from '../../../../application/ports/notification-friendship.repository';
import { SocialRelationshipEntity } from '../../../../../social/infrastructure/persistence/typeorm/entities/social-relationship.entity';

@Injectable()
export class NotificationFriendshipTypeormRepository implements NotificationFriendshipRepository {
  constructor(
    @InjectRepository(SocialRelationshipEntity)
    private readonly relationships: Repository<SocialRelationshipEntity>,
  ) {}

  async listAcceptedFriendIds(userId: number): Promise<number[]> {
    const relations = await this.relationships.find({
      where: [
        { requester: { id: userId }, status: 'accepted' },
        { addressee: { id: userId }, status: 'accepted' },
      ],
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
