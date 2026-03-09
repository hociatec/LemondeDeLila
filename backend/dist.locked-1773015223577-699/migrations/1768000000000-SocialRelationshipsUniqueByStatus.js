"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "SocialRelationshipsUniqueByStatus1768000000000", {
    enumerable: true,
    get: function() {
        return SocialRelationshipsUniqueByStatus1768000000000;
    }
});
const _typeorm = require("typeorm");
let SocialRelationshipsUniqueByStatus1768000000000 = class SocialRelationshipsUniqueByStatus1768000000000 {
    async up(queryRunner) {
        // Allow multiple relationship rows between the same pair as long as they differ by status.
        // This enables keeping "accepted" friendship while adding a one-way "blocked" record.
        await queryRunner.query(`ALTER TABLE social_relationships DROP INDEX uniq_social_relationship`);
        await queryRunner.createIndex('social_relationships', new _typeorm.TableIndex({
            name: 'uniq_social_relationship_status',
            columnNames: [
                'requester_id',
                'addressee_id',
                'status'
            ],
            isUnique: true
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropIndex('social_relationships', 'uniq_social_relationship_status');
        await queryRunner.createIndex('social_relationships', new _typeorm.TableIndex({
            name: 'uniq_social_relationship',
            columnNames: [
                'requester_id',
                'addressee_id'
            ],
            isUnique: true
        }));
    }
    constructor(){
        this.name = 'SocialRelationshipsUniqueByStatus1768000000000';
    }
};
