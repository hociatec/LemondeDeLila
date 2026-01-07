import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'social_profile_settings' })
export class SocialProfileSettingsEntity {
  @PrimaryColumn({ type: 'tinyint' })
  id!: number;

  @Column({ name: 'bio_min_length', type: 'int', default: 0 })
  bioMinLength!: number;

  @Column({ name: 'bio_max_length', type: 'int', default: 500 })
  bioMaxLength!: number;
}
