import { UnauthorizedException } from '@nestjs/common';
import type { AuthAccountReader } from '../ports/auth-account-reader.port';
import { credentialVersion } from './credential-version';

export async function validateAccountSession(
  accounts: AuthAccountReader,
  id: number,
  version: string | undefined,
) {
  const account = await accounts.findById(id);
  const bannedUntil = account?.bannedUntil?.getTime();
  if (
    !account ||
    (bannedUntil !== undefined &&
      (!Number.isFinite(bannedUntil) || bannedUntil > Date.now()))
  ) {
    throw new UnauthorizedException('Compte indisponible');
  }
  if (!account.password || version !== credentialVersion(account.password)) {
    throw new UnauthorizedException('Session expirée');
  }
  return {
    username: account.username,
    email: account.email,
    roles: account.roles,
  };
}
