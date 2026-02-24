"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddSocialModule1735100000000 = void 0;
const typeorm_1 = require("typeorm");
class AddSocialModule1735100000000 {
    name = 'AddSocialModule1735100000000';
    async up(queryRunner) {
        await queryRunner.createTable(new typeorm_1.Table({
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
                new typeorm_1.TableForeignKey({
                    columnNames: ['user_id'],
                    referencedTableName: 'users',
                    referencedColumnNames: ['id'],
                    onDelete: 'CASCADE',
                }),
            ],
        }), true);
        await queryRunner.createTable(new typeorm_1.Table({
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
                new typeorm_1.TableUnique({
                    name: 'uniq_social_relationship',
                    columnNames: ['requester_id', 'addressee_id'],
                }),
            ],
            indices: [
                new typeorm_1.TableIndex({
                    name: 'idx_social_relationship_status',
                    columnNames: ['status'],
                }),
                new typeorm_1.TableIndex({
                    name: 'idx_social_relationship_requester',
                    columnNames: ['requester_id'],
                }),
                new typeorm_1.TableIndex({
                    name: 'idx_social_relationship_addressee',
                    columnNames: ['addressee_id'],
                }),
            ],
            foreignKeys: [
                new typeorm_1.TableForeignKey({
                    columnNames: ['requester_id'],
                    referencedTableName: 'users',
                    referencedColumnNames: ['id'],
                    onDelete: 'CASCADE',
                }),
                new typeorm_1.TableForeignKey({
                    columnNames: ['addressee_id'],
                    referencedTableName: 'users',
                    referencedColumnNames: ['id'],
                    onDelete: 'CASCADE',
                }),
            ],
        }), true);
    }
    async down(queryRunner) {
        await queryRunner.dropTable('social_relationships', true);
        await queryRunner.dropTable('social_profiles', true);
    }
}
exports.AddSocialModule1735100000000 = AddSocialModule1735100000000;
//# sourceMappingURL=1735100000000-AddSocialModule.js.map