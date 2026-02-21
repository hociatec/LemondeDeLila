import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class SocialRelationshipsUniqueByStatus1768000000000 implements MigrationInterface {
  name = 'SocialRelationshipsUniqueByStatus1768000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Allow multiple relationship rows between the same pair as long as they differ by status.
    // This enables keeping "accepted" friendship while adding a one-way "blocked" record.
    await queryRunner.query(
      `ALTER TABLE social_relationships DROP INDEX uniq_social_relationship`,
    );

    await queryRunner.createIndex(
      'social_relationships',
      new TableIndex({
        name: 'uniq_social_relationship_status',
        columnNames: ['requester_id', 'addressee_id', 'status'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'social_relationships',
      'uniq_social_relationship_status',
    );

    await queryRunner.createIndex(
      'social_relationships',
      new TableIndex({
        name: 'uniq_social_relationship',
        columnNames: ['requester_id', 'addressee_id'],
        isUnique: true,
      }),
    );
  }
}
