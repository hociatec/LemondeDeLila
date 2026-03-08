"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AddSocialProfileEndgameMessages1770100000000", {
    enumerable: true,
    get: function() {
        return AddSocialProfileEndgameMessages1770100000000;
    }
});
const _typeorm = require("typeorm");
let AddSocialProfileEndgameMessages1770100000000 = class AddSocialProfileEndgameMessages1770100000000 {
    async up(queryRunner) {
        if (!await queryRunner.hasTable('social_profiles')) {
            return;
        }
        const hasVictory = await queryRunner.hasColumn('social_profiles', 'victory_message');
        if (!hasVictory) {
            await queryRunner.addColumn('social_profiles', new _typeorm.TableColumn({
                name: 'victory_message',
                type: 'varchar',
                length: '280',
                isNullable: true
            }));
        }
        const hasDefeat = await queryRunner.hasColumn('social_profiles', 'defeat_message');
        if (!hasDefeat) {
            await queryRunner.addColumn('social_profiles', new _typeorm.TableColumn({
                name: 'defeat_message',
                type: 'varchar',
                length: '280',
                isNullable: true
            }));
        }
    }
    async down(queryRunner) {
        if (!await queryRunner.hasTable('social_profiles')) {
            return;
        }
        const hasDefeat = await queryRunner.hasColumn('social_profiles', 'defeat_message');
        if (hasDefeat) {
            await queryRunner.dropColumn('social_profiles', 'defeat_message');
        }
        const hasVictory = await queryRunner.hasColumn('social_profiles', 'victory_message');
        if (hasVictory) {
            await queryRunner.dropColumn('social_profiles', 'victory_message');
        }
    }
    constructor(){
        this.name = 'AddSocialProfileEndgameMessages1770100000000';
    }
};
