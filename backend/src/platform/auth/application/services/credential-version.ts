import { createHash } from 'node:crypto';

/** Bind a session to the stored salted password hash without exposing it. */
export function credentialVersion(passwordHash: string): string {
  return createHash('sha256')
    .update('lila-session-v1\0')
    .update(passwordHash)
    .digest('hex');
}
