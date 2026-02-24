"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialRelationshipsUniqueByStatus1768000000000 = void 0;
const typeorm_1 = require("typeorm");
class SocialRelationshipsUniqueByStatus1768000000000 {
    name = 'SocialRelationshipsUniqueByStatus1768000000000';
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE social_relationships DROP INDEX uniq_social_relationship`);
        await queryRunner.createIndex('social_relationships', new typeorm_1.TableIndex({
            name: 'uniq_social_relationship_status',
            columnNames: ['requester_id', 'addressee_id', 'status'],
            isUnique: true,
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropIndex('social_relationships', 'uniq_social_relationship_status');
        await queryRunner.createIndex('social_relationships', new typeorm_1.TableIndex({
            name: 'uniq_social_relationship',
            columnNames: ['requester_id', 'addressee_id'],
            isUnique: true,
        }));
    }
}
exports.SocialRelationshipsUniqueByStatus1768000000000 = SocialRelationshipsUniqueByStatus1768000000000;
//# sourceMappingURL=1768000000000-SocialRelationshipsUniqueByStatus.js.map