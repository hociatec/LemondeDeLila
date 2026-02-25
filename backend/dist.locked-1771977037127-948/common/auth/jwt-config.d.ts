import { ConfigService } from '@nestjs/config';
import type { Algorithm } from 'jsonwebtoken';
export type JwtAlgorithm = 'HS256' | 'RS256';
export declare function getJwtAlgorithm(config: ConfigService): JwtAlgorithm;
export declare function requireJwtSigningKey(config: ConfigService): string;
export declare function requireJwtVerifyKey(config: ConfigService): string;
export declare function getJwtVerifyAlgorithms(config: ConfigService): Algorithm[];
