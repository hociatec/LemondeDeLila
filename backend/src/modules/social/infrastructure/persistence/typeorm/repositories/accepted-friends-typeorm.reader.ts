import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AcceptedFriendsReader } from '../../../../application/ports/accepted-friends-reader.port';
import { SocialRelationshipEntity } from '../entities/social-relationship.entity';

@Injectable()
export class AcceptedFriendsTypeormReader implements AcceptedFriendsReader {
  constructor(
    @InjectRepository(SocialRelationshipEntity)
    private readonly relationships: Repository<SocialRelationshipEntity>,
  ) {}

  async listAcceptedFriendIds(userId: number): Promise<number[]> {
    if (!Number.isSafeInteger(userId) || userId <= 0) return [];
    const relations = await this.relationships.find({
      where: [
        { requester: { id: userId }, status: 'accepted' },
        { addressee: { id: userId }, status: 'accepted' },
      ],
      take: 500,
      order: { id: 'ASC' },
    });

    return relations
      .map((relation) =>
        relation.requester?.id === userId
          ? relation.addressee?.id
          : relation.requester?.id,
      )
      .filter(
        (id): id is number =>
          Number.isSafeInteger(id) && id > 0 && id !== userId,
      );
  }
}
