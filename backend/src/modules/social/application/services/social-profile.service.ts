import { HttpException, Inject, Injectable } from '@nestjs/common';
import {
  SocialProfileVisibility,
  type SocialProfileRecord,
} from '../contracts/social-profile.model';
import {
  SOCIAL_PROFILE_REPOSITORY,
  type SocialProfileRepository,
} from '../ports/social-profile.repository';
import {
  SOCIAL_USER_READER,
  type SocialUserReader,
} from '../ports/social-user.repository';
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
    @Inject(SOCIAL_USER_READER)
    private readonly users: SocialUserReader,
    @Inject(SOCIAL_PROFILE_REPOSITORY)
    private readonly profiles: SocialProfileRepository,
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
    return this.users.searchUsers(sanitized, userId, 20);
  }

  private async ensureProfile(userId: number) {
    let profile = await this.profiles.findByUserId(userId);
    if (profile) {
      return profile;
    }
    const user = await this.users.findById(userId);
    if (!user) {
      throw new HttpException('Utilisateur introuvable.', 404);
    }
    profile = await this.profiles.create({
      user,
      bio: '',
      victoryMessage: null,
      defeatMessage: null,
      visibility: 'public',
    });
    return profile;
  }

  private async canViewProfile(
    viewerId: number,
    targetId: number,
    profile: SocialProfileRecord,
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
