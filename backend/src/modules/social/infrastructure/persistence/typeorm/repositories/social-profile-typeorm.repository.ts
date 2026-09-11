import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type {
  CreateSocialProfileInput,
  SocialProfileEndgameMessages,
  SocialProfileRepository,
} from '../../../../application/ports/social-profile.repository';
import type { SocialProfileRecord } from '../../../../application/models/social-profile.model';
import { SocialProfileUserRelationMissingError } from '../../../../domain/errors/social-domain.errors';
import { SocialProfileEntity } from '../entities/social-profile.entity';
import type { SocialUserPersistenceRef } from '../entities/social-user.persistence-ref';

@Injectable()
export class SocialProfileTypeormRepository implements SocialProfileRepository {
  constructor(
    @InjectRepository(SocialProfileEntity)
    private readonly profiles: Repository<SocialProfileEntity>,
  ) {}

  async findByUserId(userId: number): Promise<SocialProfileRecord | null> {
    if (!Number.isSafeInteger(userId) || userId <= 0) return null;
    const profile = await this.profiles.findOne({ where: { userId } });
    return profile ? this.toModel(profile) : null;
  }

  async findEndgameMessagesByUserIds(
    userIds: number[],
  ): Promise<SocialProfileEndgameMessages[]> {
    const normalizedUserIds = Array.isArray(userIds)
      ? [
          ...new Set(
            userIds.filter((id) => Number.isSafeInteger(id) && id > 0),
          ),
        ].slice(0, 1_000)
      : [];
    if (normalizedUserIds.length === 0) {
      return [];
    }

    const rows = await this.profiles.find({
      select: {
        userId: true,
        victoryMessage: true,
        defeatMessage: true,
      },
      where: {
        userId: In(normalizedUserIds),
      },
      order: { userId: 'ASC' },
      take: normalizedUserIds.length,
    });

    return rows.map((row) => ({
      userId: row.userId,
      victoryMessage: row.victoryMessage ?? null,
      defeatMessage: row.defeatMessage ?? null,
    }));
  }

  async create(input: CreateSocialProfileInput): Promise<SocialProfileRecord> {
    if (
      !input?.user ||
      !Number.isSafeInteger(input.user.id) ||
      input.user.id <= 0
    ) {
      throw new RangeError('Utilisateur social invalide');
    }
    const profile = this.profiles.create({
      userId: input.user.id,
      user: { id: input.user.id } as SocialUserPersistenceRef,
      bio: input.bio,
      victoryMessage: input.victoryMessage,
      defeatMessage: input.defeatMessage,
      visibility: input.visibility,
    });
    const saved = await this.profiles.save(profile);
    return this.toModel(saved, input.user);
  }

  async save(profile: SocialProfileRecord): Promise<SocialProfileRecord> {
    if (
      !profile ||
      !Number.isSafeInteger(profile.userId) ||
      profile.userId <= 0 ||
      !profile.user
    ) {
      throw new RangeError('Profil social invalide');
    }
    const saved = await this.profiles.save(
      this.profiles.create({
        userId: profile.userId,
        user: { id: profile.user.id } as SocialUserPersistenceRef,
        bio: profile.bio,
        victoryMessage: profile.victoryMessage,
        defeatMessage: profile.defeatMessage,
        visibility: profile.visibility,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      }),
    );
    return this.toModel(saved, profile.user);
  }

  private toModel(
    profile: SocialProfileEntity,
    fallbackUser?: SocialProfileRecord['user'],
  ): SocialProfileRecord {
    const user = profile.user
      ? {
          id: profile.user.id,
          username: String(profile.user.username ?? '').slice(0, 255),
          avatar:
            typeof profile.user.avatar === 'string'
              ? profile.user.avatar.slice(0, 2048)
              : null,
        }
      : fallbackUser;

    if (!user) {
      throw new SocialProfileUserRelationMissingError(
        `Social profile ${profile.userId} missing user relation`,
      );
    }

    return {
      userId: profile.userId,
      user,
      bio:
        typeof profile.bio === 'string' ? profile.bio.slice(0, 20_000) : null,
      victoryMessage:
        typeof profile.victoryMessage === 'string'
          ? profile.victoryMessage.slice(0, 2_000)
          : null,
      defeatMessage:
        typeof profile.defeatMessage === 'string'
          ? profile.defeatMessage.slice(0, 2_000)
          : null,
      visibility: profile.visibility,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }
}
