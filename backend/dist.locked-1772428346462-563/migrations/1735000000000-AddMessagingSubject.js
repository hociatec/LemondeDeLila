"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AddMessagingSubject1735000000000", {
    enumerable: true,
    get: function() {
        return AddMessagingSubject1735000000000;
    }
});
const _typeorm = require("typeorm");
let AddMessagingSubject1735000000000 = class AddMessagingSubject1735000000000 {
    async up(queryRunner) {
        await queryRunner.addColumn('messaging_private_messages', new _typeorm.TableColumn({
            name: 'subject',
            type: 'varchar',
            length: '200',
            isNullable: true
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropColumn('messaging_private_messages', 'subject');
    }
    constructor(){
        this.name = 'AddMessagingSubject1735000000000';
    }
};
