import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/** Email verification had no verification workflow and was always bypassed. */
export class RemoveUnusedEmailVerification1770300000000 implements MigrationInterface {
  name = 'RemoveUnusedEmailVerification1770300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('users', 'email_verified')) {
      await queryRunner.dropColumn('users', 'email_verified');
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('users', 'email_verified'))) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'email_verified',
          type: 'boolean',
          default: true,
        }),
      );
    }
  }
}
