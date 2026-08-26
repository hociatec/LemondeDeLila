import { BadRequestException, Injectable } from '@nestjs/common';
import bcryptImport from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class AdminUserPasswordService {
  async hashPassword(password: string): Promise<string> {
    if (!password.trim()) {
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
