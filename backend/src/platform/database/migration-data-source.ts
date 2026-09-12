import { DataSource, MigrationExecutor, type QueryRunner } from 'typeorm';
import { RdbmsSchemaBuilder } from 'typeorm/schema-builder/RdbmsSchemaBuilder';
import { ImportLegacySettingsJson1735900000000 } from './migrations/1735900000000-ImportLegacySettingsJson';

class MigrationMetadataBuilder extends RdbmsSchemaBuilder {
  ensure(queryRunner: QueryRunner): Promise<void> {
    return this.createTypeormMetadataTable(queryRunner);
  }
}

/** Compatibility belongs here: published migration sources stay immutable. */
export class MigrationDataSource extends DataSource {
  override async undoLastMigration(
    options?: Parameters<DataSource['undoLastMigration']>[0],
  ): Promise<void> {
    const [last] = await new MigrationExecutor(this).getExecutedMigrations();
    if (last?.timestamp === 1771000000000) {
      // Its published down() references columns absent from the schema.
      // Refuse before any DDL; older deployments require backup restoration.
      throw new Error(
        'Rollback boundary: DecoupleUserForeignKeys1771000000000 requires backup restoration',
      );
    }
    await super.undoLastMigration(options);
  }

  override async initialize(): Promise<this> {
    await super.initialize();
    for (const migration of this.migrations) {
      if (
        migration instanceof ImportLegacySettingsJson1735900000000 &&
        migration.name === 'ImportLegacySettingsJson1735900000'
      ) {
        // TypeORM requires 13 digits. This historical migration is a no-op;
        // rerunning it once when the ledger contains its old name is safe.
        migration.name = 'ImportLegacySettingsJson1735900000000';
      }
    }
    return this;
  }

  override async runMigrations(
    options?: Parameters<DataSource['runMigrations']>[0],
  ) {
    const runner = this.createQueryRunner();
    try {
      // Raw SQL migrations introduced generated columns without entity
      // metadata. Historic getTables() still needs TypeORM's metadata table.
      await new MigrationMetadataBuilder(this).ensure(runner);
    } finally {
      await runner.release();
    }
    // Keep the production invariant even when the CLI or a caller supplies a
    // conflicting transaction mode. MySQL DDL auto-commits and long data
    // migrations must expose their batch boundaries to the server.
    return super.runMigrations({ ...options, transaction: 'none' });
  }
}
