import { MigrationInterface, QueryRunner } from 'typeorm';

export class Auto1767479024162 implements MigrationInterface {
  name = 'Auto1767479024162';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `social_profiles` CHANGE `bio` `bio` VARCHAR(1000) NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `social_profiles` CHANGE `bio` `bio` VARCHAR(500) NULL',
    );
  }
}
