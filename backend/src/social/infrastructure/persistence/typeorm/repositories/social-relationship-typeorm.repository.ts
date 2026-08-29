import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  SocialDirection,
  SocialRelationshipRepository,
} from '../../../../application/ports/social-relationship.repository';
import type {
  SocialRelationshipRecord,
  SocialRelationshipStatus,
} from '../../../../application/models/social-relationship.model';
import { SocialRelationshipUserRelationMissingError } from '../../../../domain/errors/social-domain.errors';
import { User } from '../../../../../user/public-api';
import { SocialRelationshipEntity } from '../entities/social-relationship.entity';

@Injectable()
export class SocialRelationshipTypeormRepository implements SocialRelationshipRepository {
  constructor(
    @InjectRepository(SocialRelationshipEntity)
    private readonly relationships: Repository<SocialRelationshipEntity>,
  ) {}

  async listAcceptedForUser(
    userId: number,
  ): Promise<SocialRelationshipRecord[]> {
    const relations = await this.relationships.find({
      where: [
        { requester: { id: userId }, status: 'accepted' },
        { addressee: { id: userId }, status: 'accepted' },
      ],
      order: { updatedAt: 'DESC' },
      take: 500,
    });
    return relations.map((relation) => this.toModel(relation));
  }

  async listPendingForUser(
    userId: number,
    direction: SocialDirection,
  ): Promise<SocialRelationshipRecord[]> {
    const where =
      direction === 'incoming'
        ? { addressee: { id: userId }, status: 'pending' as const }
        : direction === 'outgoing'
          ? { requester: { id: userId }, status: 'pending' as const }
          : [
              { addressee: { id: userId }, status: 'pending' as const },
              { requester: { id: userId }, status: 'pending' as const },
            ];

    const relations = await this.relationships.find({
      where,
      order: { createdAt: 'DESC' },
      take: 500,
    });
    return relations.map((relation) => this.toModel(relation));
  }

  async listBlockedByUser(userId: number): Promise<SocialRelationshipRecord[]> {
    const relations = await this.relationships.find({
      where: { requester: { id: userId }, status: 'blocked' },
      order: { updatedAt: 'DESC' },
      take: 500,
    });
    return relations.map((relation) => this.toModel(relation));
  }

  async findRelationsBetween(
    userId: number,
    targetId: number,
  ): Promise<SocialRelationshipRecord[]> {
    const relations = await this.relationships.find({
      where: [
        { requester: { id: userId }, addressee: { id: targetId } },
        { requester: { id: targetId }, addressee: { id: userId } },
      ],
      take: 2,
    });
    return relations.map((relation) => this.toModel(relation));
  }

  async findPendingIncoming(
    userId: number,
    requesterId: number,
  ): Promise<SocialRelationshipRecord | null> {
    const relation = await this.relationships.findOne({
      where: {
        requester: { id: requesterId },
        addressee: { id: userId },
        status: 'pending',
      },
    });
    return relation ? this.toModel(relation) : null;
  }

  async findPendingOutgoing(
    userId: number,
    targetId: number,
  ): Promise<SocialRelationshipRecord | null> {
    const relation = await this.relationships.findOne({
      where: {
        requester: { id: userId },
        addressee: { id: targetId },
        status: 'pending',
      },
    });
    return relation ? this.toModel(relation) : null;
  }

  async findBlocked(
    userId: number,
    targetId: number,
  ): Promise<SocialRelationshipRecord | null> {
    const relation = await this.relationships.findOne({
      where: {
        requester: { id: userId },
        addressee: { id: targetId },
        status: 'blocked',
      },
    });
    return relation ? this.toModel(relation) : null;
  }

  async findAcceptedRelation(
    userId: number,
    targetId: number,
  ): Promise<SocialRelationshipRecord | null> {
    const relation = await this.relationships.findOne({
      where: [
        {
          requester: { id: userId },
          addressee: { id: targetId },
          status: 'accepted',
        },
        {
          requester: { id: targetId },
          addressee: { id: userId },
          status: 'accepted',
        },
      ],
    });
    return relation ? this.toModel(relation) : null;
  }

  async create(
    requesterId: number,
    addresseeId: number,
    status: SocialRelationshipStatus,
  ): Promise<SocialRelationshipRecord> {
    const relation = this.relationships.create({
      requester: { id: requesterId } as User,
      addressee: { id: addresseeId } as User,
      status,
    });
    const saved = await this.relationships.save(relation);
    return this.toModel(saved);
  }

  async save(
    relationship: SocialRelationshipRecord,
  ): Promise<SocialRelationshipRecord> {
    const saved = await this.relationships.save(
      this.relationships.create({
        id: relationship.id,
        requester: { id: relationship.requester.id } as User,
        addressee: { id: relationship.addressee.id } as User,
        status: relationship.status,
        createdAt: relationship.createdAt,
        updatedAt: relationship.updatedAt,
      }),
    );
    return this.toModel(saved, relationship);
  }

  async remove(relationship: SocialRelationshipRecord): Promise<void> {
    await this.relationships.delete({ id: relationship.id });
  }

  async removeMany(relationships: SocialRelationshipRecord[]): Promise<void> {
    if (relationships.length === 0) {
      return;
    }
    await this.relationships.delete(relationships.map((item) => item.id));
  }

  private toModel(
    relation: SocialRelationshipEntity,
    fallback?: SocialRelationshipRecord,
  ): SocialRelationshipRecord {
    const requester = relation.requester
      ? {
          id: relation.requester.id,
          username: relation.requester.username,
          avatar: relation.requester.avatar ?? null,
        }
      : fallback?.requester;
    const addressee = relation.addressee
      ? {
          id: relation.addressee.id,
          username: relation.addressee.username,
          avatar: relation.addressee.avatar ?? null,
        }
      : fallback?.addressee;

    if (!requester || !addressee) {
      throw new SocialRelationshipUserRelationMissingError(
        `Social relationship ${relation.id} missing user relation`,
      );
    }

    return {
      id: relation.id,
      requester,
      addressee,
      status: relation.status,
      createdAt: relation.createdAt,
      updatedAt: relation.updatedAt,
    };
  }
}
