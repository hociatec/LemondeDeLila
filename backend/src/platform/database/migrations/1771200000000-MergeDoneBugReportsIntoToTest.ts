import { MigrationInterface, QueryRunner } from 'typeorm';

export class MergeDoneBugReportsIntoToTest1771200000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("UPDATE bug_reports SET status = 'to_test' WHERE status = 'done'");
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // The merge deliberately has no reverse: old and existing `to_test` rows
    // cannot be distinguished after migration.
  }
}
