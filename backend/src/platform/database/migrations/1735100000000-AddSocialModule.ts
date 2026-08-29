import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
  TableUnique,
} from 'typeorm';

export class AddSocialModule1735100000000 implements MigrationInterface {
  name = 'AddSocialModule1735100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'social_profiles',
        columns: [
          {
            name: 'user_id',
            type: 'int',
            isPrimary: true,
          },
          {
            name: 'bio',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'visibility',
            type: 'varchar',
            length: '20',
            default: `'public'`,
          },
          {
            name: 'created_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'social_relationships',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'requester_id',
            type: 'int',
          },
          {
            name: 'addressee_id',
            type: 'int',
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: `'pending'`,
          },
          {
            name: 'created_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
        uniques: [
          new TableUnique({
            name: 'uniq_social_relationship',
            columnNames: ['requester_id', 'addressee_id'],
          }),
        ],
        indices: [
          new TableIndex({
            name: 'idx_social_relationship_status',
            columnNames: ['status'],
          }),
          new TableIndex({
            name: 'idx_social_relationship_requester',
            columnNames: ['requester_id'],
          }),
          new TableIndex({
            name: 'idx_social_relationship_addressee',
            columnNames: ['addressee_id'],
          }),
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['requester_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
          new TableForeignKey({
            columnNames: ['addressee_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('social_relationships', true);
    await queryRunner.dropTable('social_profiles', true);
  }
}
