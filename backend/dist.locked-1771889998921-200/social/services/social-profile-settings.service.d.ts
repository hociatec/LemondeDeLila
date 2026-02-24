import { OnModuleInit } from '@nestjs/common';
import { Repository } from 'typeorm';
import { SocialProfileSettingsEntity } from '../entities/social-profile-settings.entity';
export type SocialProfileSettings = {
    bioMinLength: number;
    bioMaxLength: number;
};
export declare class SocialProfileSettingsService implements OnModuleInit {
    private readonly repo;
    private cache;
    constructor(repo: Repository<SocialProfileSettingsEntity>);
    onModuleInit(): Promise<void>;
    private defaults;
    private normalize;
    get(): SocialProfileSettings;
    update(patch: Partial<SocialProfileSettings>): Promise<SocialProfileSettings>;
    private ensureSeeded;
}
