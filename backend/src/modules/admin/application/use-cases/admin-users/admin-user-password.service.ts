import { BadRequestException, Injectable } from '@nestjs/common';
import bcryptImport from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class AdminUserPasswordService {
  private static readonly MAX_PASSWORD_LENGTH = 1024;

  async hashPassword(password: string): Promise<string> {
    if (
      typeof password !== 'string' ||
      !password.trim() ||
      password.length > AdminUserPasswordService.MAX_PASSWORD_LENGTH
    ) {
      throw new BadRequestException('Mot de passe vide');
    }

    return bcryptImport.hash(password, 10);
  }

  generateTemporaryPassword(): string {
    return randomBytes(6)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 10);
  }
}
