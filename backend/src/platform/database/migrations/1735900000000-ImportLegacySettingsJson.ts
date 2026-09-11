import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historical migration kept for ledger compatibility. It intentionally does
 * not read runtime files: migrations must be deterministic and autonomous.
 */
export class ImportLegacySettingsJson1735900000000 implements MigrationInterface {
  name = 'ImportLegacySettingsJson1735900000';

  public async up(_queryRunner: QueryRunner): Promise<void> {}

  public async down(_queryRunner: QueryRunner): Promise<void> {}
}
