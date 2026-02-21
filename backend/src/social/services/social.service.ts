import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationService } from '../../notification/services/notification.service';
import { User } from '../../user/entities/user.entity';
import { SocialProfileSettingsService } from './social-profile-settings.service';
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
    private readonly profileSettings: SocialProfileSettingsService,
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
        // Robustesse UX : rendre l'action idempotente et éviter un "error" WS qui déclenche un dialogue modal.
        // - Si la demande a déjà été envoyée par le demandeur : on renvoie "pending".
        // - Si une demande entrante existe (l'autre a déjà demandé) : on accepte directement.
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

    // Cancel pending requests in either direction when blocking.
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
      canView,
    };
  }

  async updateProfile(userId: number, bio?: string, visibility?: string) {
    const profile = await this.ensureProfile(userId);
    if (typeof bio === 'string') {
      const trimmed = bio.trim();
      const length = trimmed.length;
      const settings = this.profileSettings.get();
      if (length < settings.bioMinLength || length > settings.bioMaxLength) {
        throw new HttpException(
          `Bio invalide (longueur ${length}). Requis: ${settings.bioMinLength}-${settings.bioMaxLength} caractères.`,
          400,
        );
      }
      profile.bio = trimmed;
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
    const buildQuery = (accentInsensitive: boolean) => {
      const qb = this.users
        .createQueryBuilder('u')
        .leftJoin(SocialProfile, 'p', 'p.userId = u.id')
        .select('u.id', 'id')
        .addSelect('u.username', 'username')
        .addSelect('u.avatar', 'avatar')
        .addSelect("COALESCE(p.visibility, 'public')", 'profileVisibility')
        .limit(20);

      if (accentInsensitive) {
        qb.where(
          'u.username COLLATE utf8mb4_0900_ai_ci LIKE :query COLLATE utf8mb4_0900_ai_ci',
          {
            query: `%${sanitized}%`,
          },
        )
          .andWhere('u.id != :userId', { userId })
          .orderBy('u.username COLLATE utf8mb4_0900_ai_ci', 'ASC')
          .addOrderBy('u.username', 'ASC')
          .addOrderBy('u.id', 'ASC');
        return qb;
      }

      qb.where('LOWER(u.username) LIKE :query', {
        query: `%${sanitized.toLowerCase()}%`,
      }).andWhere('u.id != :userId', { userId });
      return qb;
    };

    let rows: Array<{
      id: number;
      username: string;
      avatar: string | null;
      profileVisibility: SocialProfileVisibility;
    }> = [];

    try {
      rows = await buildQuery(true).getRawMany();
    } catch (error) {
      const message = String((error as any)?.message ?? '');
      if (!/collation/i.test(message)) {
        throw error;
      }
      rows = await buildQuery(false).getRawMany();
    }

    return rows.map((row) => ({
      id: row.id,
      username: row.username,
      avatar: row.avatar ?? null,
      profileVisibility: row.profileVisibility ?? 'public',
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

  private async findRelations(userId: number, targetId: number) {
    return this.relationships.find({
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
