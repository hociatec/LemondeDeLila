import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandSocialProfileBio1767600000000 implements MigrationInterface {
  name = 'ExpandSocialProfileBio1767600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `social_profiles` MODIFY `bio` LONGTEXT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `social_profiles` MODIFY `bio` VARCHAR(1000) NULL',
    );
  }
}
