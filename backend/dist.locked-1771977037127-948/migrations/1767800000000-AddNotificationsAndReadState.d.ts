import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class AddNotificationsAndReadState1767800000000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
