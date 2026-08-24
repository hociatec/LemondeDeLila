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
import { User } from '../../../../../user/public-api';
import { SocialProfileEntity } from '../entities/social-profile.entity';

@Injectable()
export class SocialProfileTypeormRepository implements SocialProfileRepository {
  constructor(
    @InjectRepository(SocialProfileEntity)
    private readonly profiles: Repository<SocialProfileEntity>,
  ) {}

  async findByUserId(userId: number): Promise<SocialProfileRecord | null> {
    const profile = await this.profiles.findOne({ where: { userId } });
    return profile ? this.toModel(profile) : null;
  }

  async findEndgameMessagesByUserIds(
    userIds: number[],
  ): Promise<SocialProfileEndgameMessages[]> {
    if (userIds.length === 0) {
      return [];
    }

    const rows = await this.profiles.find({
      select: {
        userId: true,
        victoryMessage: true,
        defeatMessage: true,
      },
      where: {
        userId: In(userIds),
      },
    });

    return rows.map((row) => ({
      userId: row.userId,
      victoryMessage: row.victoryMessage ?? null,
      defeatMessage: row.defeatMessage ?? null,
    }));
  }

  async create(input: CreateSocialProfileInput): Promise<SocialProfileRecord> {
    const profile = this.profiles.create({
      userId: input.user.id,
      user: { id: input.user.id } as User,
      bio: input.bio,
      victoryMessage: input.victoryMessage,
      defeatMessage: input.defeatMessage,
      visibility: input.visibility,
    });
    const saved = await this.profiles.save(profile);
    return this.toModel(saved, input.user);
  }

  async save(profile: SocialProfileRecord): Promise<SocialProfileRecord> {
    const saved = await this.profiles.save(
      this.profiles.create({
        userId: profile.userId,
        user: { id: profile.user.id } as User,
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
          username: profile.user.username,
          avatar: profile.user.avatar ?? null,
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
      bio: profile.bio ?? null,
      victoryMessage: profile.victoryMessage ?? null,
      defeatMessage: profile.defeatMessage ?? null,
      visibility: profile.visibility,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }
}
