import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class Auto1767479024162 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
