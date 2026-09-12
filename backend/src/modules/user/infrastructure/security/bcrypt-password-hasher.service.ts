import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import type { PasswordHasherPort } from '../../application/ports/password-hasher.port';

@Injectable()
export class BcryptPasswordHasherService implements PasswordHasherPort {
  private readonly rounds: number;

  constructor(config: ConfigService) {
    const configured = Number(config.get<number>('BCRYPT_COST', 12));
    this.rounds =
      Number.isSafeInteger(configured) && configured >= 4 && configured <= 15
        ? configured
        : 12;
  }

  async hash(value: string): Promise<string> {
    if (
      typeof value !== 'string' ||
      value.length === 0 ||
      value.length > 1024
    ) {
      throw new Error('Invalid password value');
    }
    return bcrypt.hash(value, this.rounds);
  }

  async compare(value: string, hash: string): Promise<boolean> {
    if (
      typeof value !== 'string' ||
      value.length > 1024 ||
      typeof hash !== 'string' ||
      hash.length > 256
    ) {
      return false;
    }
    return bcrypt.compare(value, hash);
  }
}
