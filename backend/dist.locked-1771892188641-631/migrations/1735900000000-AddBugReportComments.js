"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddBugReportComments1735900000000 = void 0;
const typeorm_1 = require("typeorm");
class AddBugReportComments1735900000000 {
    name = 'AddBugReportComments1735900000000';
    async up(queryRunner) {
        if (await queryRunner.hasTable('bug_report_comments')) {
            return;
        }
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'bug_report_comments',
            columns: [
                { name: 'id', type: 'varchar', length: '36', isPrimary: true },
                {
                    name: 'report_id',
                    type: 'varchar',
                    length: '36',
                    isNullable: false,
                },
                { name: 'content', type: 'longtext', isNullable: false },
                {
                    name: 'created_at',
                    type: 'datetime',
                    default: 'CURRENT_TIMESTAMP',
                },
                { name: 'created_by_user_id', type: 'int', isNullable: false },
                {
                    name: 'created_by_username',
                    type: 'varchar',
                    length: '100',
                    isNullable: false,
                },
            ],
        }), true);
        await queryRunner.createIndex('bug_report_comments', new typeorm_1.TableIndex({
            name: 'idx_bug_report_comments_report_id',
            columnNames: ['report_id'],
        }));
        await queryRunner.createIndex('bug_report_comments', new typeorm_1.TableIndex({
            name: 'idx_bug_report_comments_created_at',
            columnNames: ['created_at'],
        }));
        await queryRunner.createForeignKey('bug_report_comments', new typeorm_1.TableForeignKey({
            name: 'fk_bug_report_comments_report_id',
            columnNames: ['report_id'],
            referencedTableName: 'bug_reports',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
        }));
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('bug_report_comments'))) {
            return;
        }
        await queryRunner.dropTable('bug_report_comments', true);
    }
}
exports.AddBugReportComments1735900000000 = AddBugReportComments1735900000000;
//# sourceMappingURL=1735900000000-AddBugReportComments.js.map