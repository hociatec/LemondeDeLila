import { Injectable } from '@nestjs/common';
import { PresenceService } from '../../../presence/public-api';
import type { VaultPresencePort } from '../../application/ports/vault-presence.port';

@Injectable()
export class VaultPresenceAdapter implements VaultPresencePort {
  constructor(private readonly presence: PresenceService) {}

  isUserInTavern(userId: number): boolean {
    return this.presence.isUserInTavern(userId);
  }
}
