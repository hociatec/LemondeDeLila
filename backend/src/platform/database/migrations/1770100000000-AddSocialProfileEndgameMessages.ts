import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSocialProfileEndgameMessages1770100000000 implements MigrationInterface {
  name = 'AddSocialProfileEndgameMessages1770100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('social_profiles'))) {
      return;
    }

    const hasVictory = await queryRunner.hasColumn(
      'social_profiles',
      'victory_message',
    );
    if (!hasVictory) {
      await queryRunner.addColumn(
        'social_profiles',
        new TableColumn({
          name: 'victory_message',
          type: 'varchar',
          length: '280',
          isNullable: true,
        }),
      );
    }

    const hasDefeat = await queryRunner.hasColumn(
      'social_profiles',
      'defeat_message',
    );
    if (!hasDefeat) {
      await queryRunner.addColumn(
        'social_profiles',
        new TableColumn({
          name: 'defeat_message',
          type: 'varchar',
          length: '280',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('social_profiles'))) {
      return;
    }

    const hasDefeat = await queryRunner.hasColumn(
      'social_profiles',
      'defeat_message',
    );
    if (hasDefeat) {
      await queryRunner.dropColumn('social_profiles', 'defeat_message');
    }

    const hasVictory = await queryRunner.hasColumn(
      'social_profiles',
      'victory_message',
    );
    if (hasVictory) {
      await queryRunner.dropColumn('social_profiles', 'victory_message');
    }
  }
}
