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
import { SocialRelationshipEntity } from '../entities/social-relationship.entity';
import type { SocialUserPersistenceRef } from '../entities/social-user.persistence-ref';

@Injectable()
export class SocialRelationshipTypeormRepository implements SocialRelationshipRepository {
  constructor(
    @InjectRepository(SocialRelationshipEntity)
    private readonly relationships: Repository<SocialRelationshipEntity>,
  ) {}

  async listAcceptedForUser(
    userId: number,
  ): Promise<SocialRelationshipRecord[]> {
    if (!Number.isSafeInteger(userId) || userId <= 0) return [];
    const relations = await this.relationships.find({
      where: [
        { requester: { id: userId }, status: 'accepted' },
        { addressee: { id: userId }, status: 'accepted' },
      ],
      order: { updatedAt: 'DESC', id: 'DESC' },
      take: 500,
    });
    return relations.map((relation) => this.toModel(relation));
  }

  async listPendingForUser(
    userId: number,
    direction: SocialDirection,
  ): Promise<SocialRelationshipRecord[]> {
    if (!Number.isSafeInteger(userId) || userId <= 0) return [];
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
      order: { createdAt: 'DESC', id: 'DESC' },
      take: 500,
    });
    return relations.map((relation) => this.toModel(relation));
  }

  async listBlockedByUser(userId: number): Promise<SocialRelationshipRecord[]> {
    if (!Number.isSafeInteger(userId) || userId <= 0) return [];
    const relations = await this.relationships.find({
      where: { requester: { id: userId }, status: 'blocked' },
      order: { updatedAt: 'DESC', id: 'DESC' },
      take: 500,
    });
    return relations.map((relation) => this.toModel(relation));
  }

  async findRelationsBetween(
    userId: number,
    targetId: number,
  ): Promise<SocialRelationshipRecord[]> {
    if (
      !Number.isSafeInteger(userId) ||
      userId <= 0 ||
      !Number.isSafeInteger(targetId) ||
      targetId <= 0
    )
      return [];
    const relations = await this.relationships.find({
      where: [
        { requester: { id: userId }, addressee: { id: targetId } },
        { requester: { id: targetId }, addressee: { id: userId } },
      ],
      order: { createdAt: 'ASC', id: 'ASC' },
      take: 2,
    });
    return relations.map((relation) => this.toModel(relation));
  }

  async findPendingIncoming(
    userId: number,
    requesterId: number,
  ): Promise<SocialRelationshipRecord | null> {
    if (
      !Number.isSafeInteger(userId) ||
      userId <= 0 ||
      !Number.isSafeInteger(requesterId) ||
      requesterId <= 0
    )
      return null;
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
    if (
      !Number.isSafeInteger(userId) ||
      userId <= 0 ||
      !Number.isSafeInteger(targetId) ||
      targetId <= 0
    )
      return null;
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
    if (
      !Number.isSafeInteger(userId) ||
      userId <= 0 ||
      !Number.isSafeInteger(targetId) ||
      targetId <= 0
    )
      return null;
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
    if (
      !Number.isSafeInteger(userId) ||
      userId <= 0 ||
      !Number.isSafeInteger(targetId) ||
      targetId <= 0
    )
      return null;
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
    if (
      !Number.isSafeInteger(requesterId) ||
      requesterId <= 0 ||
      !Number.isSafeInteger(addresseeId) ||
      addresseeId <= 0
    ) {
      throw new RangeError('Identifiants sociaux invalides');
    }
    const relation = this.relationships.create({
      requester: { id: requesterId } as SocialUserPersistenceRef,
      addressee: { id: addresseeId } as SocialUserPersistenceRef,
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
        requester: {
          id: relationship.requester.id,
        } as SocialUserPersistenceRef,
        addressee: {
          id: relationship.addressee.id,
        } as SocialUserPersistenceRef,
        status: relationship.status,
        createdAt: relationship.createdAt,
        updatedAt: relationship.updatedAt,
      }),
    );
    return this.toModel(saved, relationship);
  }

  async remove(relationship: SocialRelationshipRecord): Promise<void> {
    if (
      !relationship ||
      !Number.isSafeInteger(relationship.id) ||
      relationship.id <= 0
    )
      return;
    await this.relationships.delete({ id: relationship.id });
  }

  async removeMany(relationships: SocialRelationshipRecord[]): Promise<void> {
    if (!Array.isArray(relationships) || relationships.length === 0) {
      return;
    }
    const ids = relationships
      .map((item) => item?.id)
      .filter((id): id is number => Number.isSafeInteger(id) && id > 0)
      .slice(0, 500);
    if (ids.length > 0) await this.relationships.delete(ids);
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
