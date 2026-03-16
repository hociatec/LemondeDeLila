"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "Auto1767479024162", {
    enumerable: true,
    get: function() {
        return Auto1767479024162;
    }
});
let Auto1767479024162 = class Auto1767479024162 {
    async up(queryRunner) {
        await queryRunner.query('ALTER TABLE `social_profiles` CHANGE `bio` `bio` VARCHAR(1000) NULL');
    }
    async down(queryRunner) {
        await queryRunner.query('ALTER TABLE `social_profiles` CHANGE `bio` `bio` VARCHAR(500) NULL');
    }
    constructor(){
        this.name = 'Auto1767479024162';
    }
};
