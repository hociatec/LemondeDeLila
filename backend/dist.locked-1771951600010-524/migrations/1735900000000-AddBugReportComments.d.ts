import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class AddBugReportComments1735900000000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
