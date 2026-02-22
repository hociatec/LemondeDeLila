import type { QueryRunner } from 'typeorm';
import { MigrationInterface } from 'typeorm';
export declare class PurgePetitChevauxFromDb1768200000000 implements MigrationInterface {
    up(queryRunner: QueryRunner): Promise<void>;
    down(_queryRunner: QueryRunner): Promise<void>;
}
