import type { MigrationInterface, QueryRunner } from 'typeorm';

type DuplicatePair = { low_id: number; high_id: number; occurrences: number };

export class CanonicalizeSocialRelationshipPairs1770700000000 implements MigrationInterface {
  name = 'CanonicalizeSocialRelationshipPairs1770700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const duplicates = (await queryRunner.query(
      `SELECT LEAST(requester_id, addressee_id) AS low_id,
              GREATEST(requester_id, addressee_id) AS high_id,
              COUNT(*) AS occurrences
       FROM social_relationships
       GROUP BY LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id)
       HAVING COUNT(*) > 1
       LIMIT 1`,
    )) as DuplicatePair[];
    if (duplicates.length > 0) {
      throw new Error(
        `Relations sociales croisées à résoudre avant migration: ${duplicates[0].low_id}/${duplicates[0].high_id}`,
      );
    }
    await queryRunner.query(
      'ALTER TABLE `social_relationships` ADD COLUMN `pair_low_id` int GENERATED ALWAYS AS (LEAST(`requester_id`, `addressee_id`)) VIRTUAL, ADD COLUMN `pair_high_id` int GENERATED ALWAYS AS (GREATEST(`requester_id`, `addressee_id`)) VIRTUAL',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX `uniq_social_relationship_pair` ON `social_relationships` (`pair_low_id`, `pair_high_id`)',
    );
    await queryRunner.query(
      'DROP INDEX `uniq_social_relationship_status` ON `social_relationships`',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE UNIQUE INDEX `uniq_social_relationship_status` ON `social_relationships` (`requester_id`, `addressee_id`, `status`)',
    );
    await queryRunner.query(
      'ALTER TABLE `social_relationships` DROP INDEX `uniq_social_relationship_pair`, DROP COLUMN `pair_high_id`, DROP COLUMN `pair_low_id`',
    );
  }
}
