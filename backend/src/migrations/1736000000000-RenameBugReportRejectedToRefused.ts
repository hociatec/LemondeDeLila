import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameBugReportRejectedToRefused1736000000000 implements MigrationInterface {
  name = 'RenameBugReportRejectedToRefused1736000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "UPDATE bug_reports SET status = 'refused' WHERE status = 'rejected'",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "UPDATE bug_reports SET status = 'rejected' WHERE status = 'refused'",
    );
  }
}

