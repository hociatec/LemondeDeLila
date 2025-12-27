import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationService } from '../../notification/services/notification.service';
import { User } from '../../user/entities/user.entity';
import {
  SocialProfile,
  SocialProfileVisibility,
} from '../entities/social-profile.entity';
import {
  SocialRelationship,
  SocialRelationshipStatus,
} from '../entities/social-relationship.entity';

const PROFILE_VISIBILITY: SocialProfileVisibility[] = [
  'public',
  'friends',
  'private',
];

@Injectable()
export class SocialService {
  constructor(
    @InjectRepository(SocialRelationship)
    private readonly relationships: Repository<SocialRelationship>,
    @InjectRepository(SocialProfile)
    private readonly profiles: Repository<SocialProfile>,
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

  async listRequests(
    userId: number,
    direction: 'incoming' | 'outgoing' | 'all',
  ) {
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

    const existing = await this.findRelation(requesterId, addresseeId);
    if (existing) {
      if (existing.status === 'blocked') {
        throw new HttpException('Relation bloquee.', 403);
      }
      if (existing.status === 'accepted') {
        return { status: 'accepted' };
      }
      throw new HttpException('Demande deja en attente.', 409);
    }

    const relation = this.relationships.create({
      requester: { id: requesterId } as User,
      addressee: { id: addresseeId } as User,
      status: 'pending',
    });
    const saved = await this.relationships.save(relation);

    await this.notifications.notifyUser(
      addresseeId,
      'social.friend.requested',
      {
        requesterId,
      },
    );

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

    const existing = await this.findRelation(userId, targetId);
    if (existing) {
      await this.relationships.remove(existing);
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

  async getProfile(viewerId: number, targetId: number) {
    const profile = await this.ensureProfile(targetId);
    const canView = await this.canViewProfile(viewerId, targetId, profile);
    return {
      user: {
        id: profile.user.id,
        username: profile.user.username,
        avatar: profile.user.avatar ?? null,
      },
      bio: canView ? (profile.bio ?? '') : '',
      visibility: profile.visibility,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      isOwner: viewerId === targetId,
    };
  }

  async updateProfile(userId: number, bio?: string, visibility?: string) {
    const profile = await this.ensureProfile(userId);
    if (typeof bio === 'string') {
      profile.bio = bio.trim();
    }
    if (typeof visibility === 'string') {
      const normalized = visibility
        .trim()
        .toLowerCase() as SocialProfileVisibility;
      if (!PROFILE_VISIBILITY.includes(normalized)) {
        throw new HttpException('Visibilite invalide.', 400);
      }
      profile.visibility = normalized;
    }
    await this.profiles.save(profile);
    return this.getProfile(userId, userId);
  }

  async searchUsers(query: string, userId: number) {
    const sanitized = query.trim();
    if (!sanitized) {
      return [];
    }
    const users = await this.users
      .createQueryBuilder('u')
      .select(['u.id', 'u.username', 'u.avatar'])
      .where('LOWER(u.username) LIKE :query', {
        query: `%${sanitized.toLowerCase()}%`,
      })
      .andWhere('u.id != :userId', { userId })
      .limit(20)
      .getMany();

    return users.map((user) => ({
      id: user.id,
      username: user.username,
      avatar: user.avatar ?? null,
    }));
  }

  private async ensureProfile(userId: number) {
    let profile = await this.profiles.findOne({ where: { userId } });
    if (profile) {
      return profile;
    }
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new HttpException('Utilisateur introuvable.', 404);
    }
    profile = this.profiles.create({
      userId,
      user,
      bio: '',
      visibility: 'public',
    });
    return this.profiles.save(profile);
  }

  private async canViewProfile(
    viewerId: number,
    targetId: number,
    profile: SocialProfile,
  ) {
    if (viewerId === targetId) {
      return true;
    }
    if (profile.visibility === 'public') {
      return true;
    }
    if (profile.visibility === 'private') {
      return false;
    }
    const relation = await this.findAcceptedRelation(viewerId, targetId);
    return Boolean(relation);
  }

  private async findRelation(userId: number, targetId: number) {
    return this.relationships.findOne({
      where: [
        { requester: { id: userId }, addressee: { id: targetId } },
        { requester: { id: targetId }, addressee: { id: userId } },
      ],
    });
  }

  private async findAcceptedRelation(userId: number, targetId: number) {
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
}
