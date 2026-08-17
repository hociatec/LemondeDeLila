import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationService } from '../../notification/services/notification.service';
import { User } from '../../user/entities/user.entity';
import { SocialRelationship } from '../entities/social-relationship.entity';

export type SocialDirection = 'incoming' | 'outgoing' | 'all';

@Injectable()
export class SocialRelationshipService {
  constructor(
    @InjectRepository(SocialRelationship)
    private readonly relationships: Repository<SocialRelationship>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly notifications: NotificationService,
  ) {}

  async listFriends(userId: number) {
    const relations = await this.relationships.find({
      where: [
        { requester: { id: userId }, status: 'accepted' },
        { addressee: { id: userId }, status: 'accepted' },
      ],
      order: { updatedAt: 'DESC' },
    });
    return relations.map((relation) => {
      const friend =
        relation.requester.id === userId
          ? relation.addressee
          : relation.requester;
      return {
        id: friend.id,
        username: friend.username,
        avatar: friend.avatar ?? null,
        since: relation.updatedAt,
      };
    });
  }

  async listRequests(userId: number, direction: SocialDirection) {
    const where =
      direction === 'incoming'
        ? { addressee: { id: userId }, status: 'pending' }
        : direction === 'outgoing'
          ? { requester: { id: userId }, status: 'pending' }
          : [
              { addressee: { id: userId }, status: 'pending' },
              { requester: { id: userId }, status: 'pending' },
            ];

    const relations = await this.relationships.find({
      where: where as any,
      order: { createdAt: 'DESC' },
    });

    return relations.map((relation) => ({
      id: relation.id,
      requester: {
        id: relation.requester.id,
        username: relation.requester.username,
        avatar: relation.requester.avatar ?? null,
      },
      addressee: {
        id: relation.addressee.id,
        username: relation.addressee.username,
        avatar: relation.addressee.avatar ?? null,
      },
      createdAt: relation.createdAt,
    }));
  }

  async listBlocked(userId: number) {
    const relations = await this.relationships.find({
      where: { requester: { id: userId }, status: 'blocked' },
      order: { updatedAt: 'DESC' },
    });
    return relations.map((relation) => ({
      id: relation.addressee.id,
      username: relation.addressee.username,
      avatar: relation.addressee.avatar ?? null,
      blockedAt: relation.updatedAt,
    }));
  }

  async requestFriend(requesterId: number, addresseeId: number) {
    if (requesterId === addresseeId) {
      throw new HttpException('Impossible de vous ajouter vous-meme.', 400);
    }

    const addressee = await this.users.findOne({
      where: { id: addresseeId },
      select: ['id', 'username', 'avatar'],
    });
    if (!addressee) {
      throw new HttpException('Utilisateur introuvable.', 404);
    }

    const existing = await this.findRelations(requesterId, addresseeId);
    if (existing.length > 0) {
        if (existing.some((r) => r.status === 'blocked')) {
        throw new HttpException('Relation bloquee.', 403);
      }
      if (existing.some((r) => r.status === 'accepted')) {
        return { status: 'accepted' };
      }
      const pending = existing.find((r) => r.status === 'pending');
      if (pending) {
        if (
          pending.requester?.id === requesterId &&
          pending.addressee?.id === addresseeId
        ) {
          return {
            id: pending.id,
            status: pending.status,
            createdAt: pending.createdAt,
          };
        }

        if (
          pending.requester?.id === addresseeId &&
          pending.addressee?.id === requesterId
        ) {
          pending.status = 'accepted';
          const saved = await this.relationships.save(pending);

          await this.notifications.notifyUser(
            addresseeId,
            'social.friend.accepted',
            {
              userId: requesterId,
            },
          );

          return {
            id: saved.id,
            status: saved.status,
            updatedAt: saved.updatedAt,
          };
        }

        return { status: 'pending' };
      }
    }

    const relation = this.relationships.create({
      requester: { id: requesterId } as User,
      addressee: { id: addresseeId } as User,
      status: 'pending',
    });
    const saved = await this.relationships.save(relation);

    await this.notifications.notifyUser(addresseeId, 'social.friend.requested', {
      requesterId,
    });

    return {
      id: saved.id,
      status: saved.status,
      createdAt: saved.createdAt,
    };
  }

  async acceptFriend(userId: number, requesterId: number) {
    const relation = await this.relationships.findOne({
      where: {
        requester: { id: requesterId },
        addressee: { id: userId },
        status: 'pending',
      },
    });
    if (!relation) {
      throw new HttpException('Demande introuvable.', 404);
    }

    relation.status = 'accepted';
    const saved = await this.relationships.save(relation);

    await this.notifications.notifyUser(requesterId, 'social.friend.accepted', {
      userId,
    });

    return {
      id: saved.id,
      status: saved.status,
      updatedAt: saved.updatedAt,
    };
  }

  async rejectFriend(userId: number, requesterId: number) {
    const relation = await this.relationships.findOne({
      where: {
        requester: { id: requesterId },
        addressee: { id: userId },
        status: 'pending',
      },
    });
    if (!relation) {
      throw new HttpException('Demande introuvable.', 404);
    }

    await this.relationships.remove(relation);

    await this.notifications.notifyUser(requesterId, 'social.friend.rejected', {
      userId,
    });

    return { removed: true };
  }

  async cancelRequest(userId: number, targetId: number) {
    const relation = await this.relationships.findOne({
      where: {
        requester: { id: userId },
        addressee: { id: targetId },
        status: 'pending',
      },
    });
    if (!relation) {
      throw new HttpException('Demande introuvable.', 404);
    }
    await this.relationships.remove(relation);
    return { removed: true };
  }

  async removeFriend(userId: number, targetId: number) {
    const relation = await this.findAcceptedRelation(userId, targetId);
    if (!relation) {
      throw new HttpException('Amitie introuvable.', 404);
    }
    await this.relationships.remove(relation);
    return { removed: true };
  }

  async blockUser(userId: number, targetId: number) {
    if (userId === targetId) {
      throw new HttpException('Impossible de vous bloquer vous-meme.', 400);
    }
    const target = await this.users.findOne({
      where: { id: targetId },
      select: ['id', 'username'],
    });
    if (!target) {
      throw new HttpException('Utilisateur introuvable.', 404);
    }

    const existing = await this.findRelations(userId, targetId);
    const alreadyBlocked = existing.find(
      (r) =>
        r.status === 'blocked' &&
        r.requester.id === userId &&
        r.addressee.id === targetId,
    );
    if (alreadyBlocked) {
      return {
        id: alreadyBlocked.id,
        status: alreadyBlocked.status,
        updatedAt: alreadyBlocked.updatedAt,
      };
    }

    const pending = existing.filter((r) => r.status === 'pending');
    if (pending.length > 0) {
      await this.relationships.remove(pending);
    }

    const blocked = this.relationships.create({
      requester: { id: userId } as User,
      addressee: { id: targetId } as User,
      status: 'blocked',
    });
    const saved = await this.relationships.save(blocked);
    return { id: saved.id, status: saved.status, updatedAt: saved.updatedAt };
  }

  async unblockUser(userId: number, targetId: number) {
    const relation = await this.relationships.findOne({
      where: {
        requester: { id: userId },
        addressee: { id: targetId },
        status: 'blocked',
      },
    });
    if (!relation) {
      throw new HttpException('Blocage introuvable.', 404);
    }
    await this.relationships.remove(relation);
    return { removed: true };
  }

  async findAcceptedRelation(userId: number, targetId: number) {
    return this.relationships.findOne({
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
  }

  private async findRelations(userId: number, targetId: number) {
    return this.relationships.find({
      where: [
        { requester: { id: userId }, addressee: { id: targetId } },
        { requester: { id: targetId }, addressee: { id: userId } },
      ],
    });
  }
}
