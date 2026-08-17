import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SocialProfile,
  SocialProfileVisibility,
} from '../entities/social-profile.entity';
import { User } from '../../user/entities/user.entity';
import { SocialProfileSettingsService } from './social-profile-settings.service';
import { SocialRelationshipService } from './social-relationship.service';

const PROFILE_VISIBILITY: SocialProfileVisibility[] = [
  'public',
  'friends',
  'private',
];
const PROFILE_ENDGAME_MESSAGE_MAX_LENGTH = 280;

@Injectable()
export class SocialProfileService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(SocialProfile)
    private readonly profiles: Repository<SocialProfile>,
    private readonly settings: SocialProfileSettingsService,
    private readonly relationships: SocialRelationshipService,
  ) {}

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
      victoryMessage: canView ? (profile.victoryMessage ?? '') : '',
      defeatMessage: canView ? (profile.defeatMessage ?? '') : '',
      visibility: profile.visibility,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      isOwner: viewerId === targetId,
      canView,
    };
  }

  async updateProfile(
    userId: number,
    bio?: string,
    victoryMessage?: string,
    defeatMessage?: string,
    visibility?: string,
  ) {
    const profile = await this.ensureProfile(userId);
    if (typeof bio === 'string') {
      const trimmed = bio.trim();
      const length = trimmed.length;
      const settings = this.settings.get();
      if (length < settings.bioMinLength || length > settings.bioMaxLength) {
        throw new HttpException(
          `Bio invalide (longueur ${length}). Requis: ${settings.bioMinLength}-${settings.bioMaxLength} caracteres.`,
          400,
        );
      }
      profile.bio = trimmed;
    }
    if (typeof victoryMessage === 'string') {
      const trimmed = victoryMessage.trim();
      if (trimmed.length > PROFILE_ENDGAME_MESSAGE_MAX_LENGTH) {
        throw new HttpException(
          `Message de victoire invalide (maximum ${PROFILE_ENDGAME_MESSAGE_MAX_LENGTH} caracteres).`,
          400,
        );
      }
      profile.victoryMessage = trimmed.length > 0 ? trimmed : null;
    }
    if (typeof defeatMessage === 'string') {
      const trimmed = defeatMessage.trim();
      if (trimmed.length > PROFILE_ENDGAME_MESSAGE_MAX_LENGTH) {
        throw new HttpException(
          `Message de defaite invalide (maximum ${PROFILE_ENDGAME_MESSAGE_MAX_LENGTH} caracteres).`,
          400,
        );
      }
      profile.defeatMessage = trimmed.length > 0 ? trimmed : null;
    }
    if (typeof visibility === 'string') {
      const normalized = visibility.trim().toLowerCase() as SocialProfileVisibility;
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
      const message = String(error?.message ?? '');
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
      victoryMessage: null,
      defeatMessage: null,
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
    const relation = await this.relationships.findAcceptedRelation(
      viewerId,
      targetId,
    );
    return Boolean(relation);
  }
}
