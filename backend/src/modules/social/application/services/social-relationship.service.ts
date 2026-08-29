import { HttpException, Inject, Injectable } from '@nestjs/common';
import {
  SOCIAL_RELATIONSHIP_REPOSITORY,
  type SocialDirection,
  type SocialRelationshipRepository,
} from '../ports/social-relationship.repository';
import {
  SOCIAL_RELATIONSHIP_NOTIFIER,
  type SocialRelationshipNotifier,
} from '../ports/social-relationship-notifier.port';
import {
  SOCIAL_USER_READER,
  type SocialUserReader,
} from '../ports/social-user.repository';

@Injectable()
export class SocialRelationshipService {
  constructor(
    @Inject(SOCIAL_RELATIONSHIP_REPOSITORY)
    private readonly relationships: SocialRelationshipRepository,
    @Inject(SOCIAL_USER_READER)
    private readonly users: SocialUserReader,
    @Inject(SOCIAL_RELATIONSHIP_NOTIFIER)
    private readonly notifications: SocialRelationshipNotifier,
  ) {}

  async listFriends(userId: number) {
    const relations = await this.relationships.listAcceptedForUser(userId);
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
    const relations = await this.relationships.listPendingForUser(
      userId,
      direction,
    );

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
    const relations = await this.relationships.listBlockedByUser(userId);
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

    const addressee = await this.users.findById(addresseeId);
    if (!addressee) {
      throw new HttpException('Utilisateur introuvable.', 404);
    }

    const existing = await this.relationships.findRelationsBetween(
      requesterId,
      addresseeId,
    );
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
          const saved = await this.relationships.save({
            ...pending,
            status: 'accepted',
          });

          await this.notifications.notifyFriendAccepted(addresseeId, {
            userId: requesterId,
          });

          return {
            id: saved.id,
            status: saved.status,
            updatedAt: saved.updatedAt,
          };
        }

        return { status: 'pending' };
      }
    }

    const saved = await this.relationships.create(
      requesterId,
      addresseeId,
      'pending',
    );

    await this.notifications.notifyFriendRequested(addresseeId, {
      requesterId,
    });

    return {
      id: saved.id,
      status: saved.status,
      createdAt: saved.createdAt,
    };
  }

  async acceptFriend(userId: number, requesterId: number) {
    const relation = await this.relationships.findPendingIncoming(
      userId,
      requesterId,
    );
    if (!relation) {
      throw new HttpException('Demande introuvable.', 404);
    }

    const saved = await this.relationships.save({
      ...relation,
      status: 'accepted',
    });

    await this.notifications.notifyFriendAccepted(requesterId, {
      userId,
    });

    return {
      id: saved.id,
      status: saved.status,
      updatedAt: saved.updatedAt,
    };
  }

  async rejectFriend(userId: number, requesterId: number) {
    const relation = await this.relationships.findPendingIncoming(
      userId,
      requesterId,
    );
    if (!relation) {
      throw new HttpException('Demande introuvable.', 404);
    }

    await this.relationships.remove(relation);

    await this.notifications.notifyFriendRejected(requesterId, {
      userId,
    });

    return { removed: true };
  }

  async cancelRequest(userId: number, targetId: number) {
    const relation = await this.relationships.findPendingOutgoing(
      userId,
      targetId,
    );
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
    const target = await this.users.findById(targetId);
    if (!target) {
      throw new HttpException('Utilisateur introuvable.', 404);
    }

    const existing = await this.relationships.findRelationsBetween(
      userId,
      targetId,
    );
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
      await this.relationships.removeMany(pending);
    }

    const saved = await this.relationships.create(userId, targetId, 'blocked');
    return { id: saved.id, status: saved.status, updatedAt: saved.updatedAt };
  }

  async unblockUser(userId: number, targetId: number) {
    const relation = await this.relationships.findBlocked(userId, targetId);
    if (!relation) {
      throw new HttpException('Blocage introuvable.', 404);
    }
    await this.relationships.remove(relation);
    return { removed: true };
  }

  async findAcceptedRelation(userId: number, targetId: number) {
    return this.relationships.findAcceptedRelation(userId, targetId);
  }
}
