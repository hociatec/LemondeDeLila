import type { QueryRunner } from 'typeorm';
import { MigrationInterface } from 'typeorm';
export declare class PurgeLoupGarouFromDb1768300000000 implements MigrationInterface {
    up(queryRunner: QueryRunner): Promise<void>;
    down(_queryRunner: QueryRunner): Promise<void>;
}
