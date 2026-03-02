"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ExpandSocialProfileBio1767600000000", {
    enumerable: true,
    get: function() {
        return ExpandSocialProfileBio1767600000000;
    }
});
let ExpandSocialProfileBio1767600000000 = class ExpandSocialProfileBio1767600000000 {
    async up(queryRunner) {
        await queryRunner.query('ALTER TABLE `social_profiles` MODIFY `bio` LONGTEXT NULL');
    }
    async down(queryRunner) {
        await queryRunner.query('ALTER TABLE `social_profiles` MODIFY `bio` VARCHAR(1000) NULL');
    }
    constructor(){
        this.name = 'ExpandSocialProfileBio1767600000000';
    }
};
