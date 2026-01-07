import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class SocialProfileSettings1735700000000 implements MigrationInterface {
  name = 'SocialProfileSettings1735700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('social_profile_settings'))) {
      await queryRunner.createTable(
        new Table({
          name: 'social_profile_settings',
          columns: [
            { name: 'id', type: 'tinyint', isPrimary: true },
            { name: 'bio_min_length', type: 'int', default: 0 },
            { name: 'bio_max_length', type: 'int', default: 500 },
          ],
        }),
        true,
      );
    }

    const existing = (await queryRunner.query(
      'SELECT id FROM social_profile_settings WHERE id = 1 LIMIT 1',
    )) as Array<{ id: number }>;
    if (existing.length === 0) {
      await queryRunner.query(
        'INSERT INTO social_profile_settings (id, bio_min_length, bio_max_length) VALUES (1, ?, ?)',
        [0, 500],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('social_profile_settings', true);
  }
}
