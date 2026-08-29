import type { MigrationInterface, QueryRunner } from 'typeorm';

type DuplicateIdentityRow = { identity: string; occurrences: number | string };

export class NormalizeUserIdentityCollation1770500000000 implements MigrationInterface {
  name = 'NormalizeUserIdentityCollation1770500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.assertNoNormalizedDuplicates(queryRunner, 'email');
    await this.assertNoNormalizedDuplicates(queryRunner, 'username');
    await queryRunner.query(
      'UPDATE `users` SET `email` = LOWER(TRIM(`email`)), `username` = TRIM(`username`)',
    );
    await queryRunner.query(
      'ALTER TABLE `users` MODIFY `email` varchar(180) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `users` MODIFY `username` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `users` MODIFY `username` varchar(100) CHARACTER SET utf8mb4 NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `users` MODIFY `email` varchar(180) CHARACTER SET utf8mb4 NOT NULL',
    );
  }

  private async assertNoNormalizedDuplicates(
    queryRunner: QueryRunner,
    column: 'email' | 'username',
  ): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT LOWER(TRIM(\`${column}\`)) AS identity, COUNT(*) AS occurrences
       FROM \`users\`
       GROUP BY LOWER(TRIM(\`${column}\`))
       HAVING COUNT(*) > 1
       LIMIT 1`,
    )) as DuplicateIdentityRow[];
    if (rows.length > 0) {
      throw new Error(
        `Impossible de normaliser users.${column}: identité dupliquée (${rows[0].identity})`,
      );
    }
  }
}
